import { AutoRouter } from 'itty-router/AutoRouter';
import { error } from 'itty-router/error';
import { cors } from 'itty-router/cors';
import type { IRequest } from 'itty-router';
import { Telegram } from '@/telegram';
import * as db from '@/db';
import { processMessage } from '@/messageProcessor';
import { MessageSender } from '@/messageSender';
import { generateSecret, sha256, generateReference } from '@/cryptoUtils';
import {
	App,
	Env,
	TelegramUpdate,
	InitResponse,
	IncomingInitData,
	DatesRequest,
} from '@/types/types';

type ExtendedRequest = IRequest & App;

const router = AutoRouter<ExtendedRequest, [Env, ExecutionContext]>({
	base: '/',
	before: [
		async (request, env, ctx) => {
			const { preflight, corsify } = cors({
				origin: env.FRONTEND_URL,
				allowMethods: ['GET', 'POST', 'OPTIONS'],
				allowHeaders: ['Content-Type', 'Authorization'],
				maxAge: 86400,
			});

			// Handle preflight requests
			if (request.method === 'OPTIONS') {
				return preflight(request);
			}

			const telegram = new Telegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_USE_TEST_API);
			const is_localhost = request.headers.get('Host')?.match(/^(localhost|127\.0\.0\.1)/) !== null;

			let bot_name = await db.getSetting(env.D1_DATABASE, 'bot_name');
			if (!bot_name) {
				const me = await telegram.getMe();
				bot_name = me.result?.username ?? null;
				if (bot_name) {
					const result = await db.setSetting(env.D1_DATABASE, 'bot_name', bot_name);
					if (!result.success) {
						return error(500, 'Failed to set setting');
					}
				} else {
					return error(500, 'Failed to get bot username');
				}
			}

			// Extend the request with our custom App properties
			Object.assign(request, { telegram, is_localhost, bot_name, env, ctx, corsify });
		},
	],
	catch: err => {
		console.error('Uncaught error:', err);
		if (err instanceof Error) {
			return error(500, err.message);
		}
		return error(500, 'An unexpected error occurred');
	},
	missing: () => error(404, 'Not Found'),
	finally: [
		(response, request) => {
			// Apply CORS headers to all responses
			return request.corsify ? request.corsify(response) : response;
		},
	],
});

router
	.post('/miniApp/init', async ({ telegram, env, json }) => {
		const incomingData = await json<IncomingInitData>();

		if (typeof incomingData?.init_data_raw !== 'string') {
			return error(400, 'Invalid initDataRaw');
		}

		const { expected_hash, calculated_hash, data } = await telegram.calculateHashes(
			incomingData.init_data_raw
		);

		if (expected_hash !== calculated_hash) {
			return error(401, 'Unauthorized');
		}

		const currentTime = Math.floor(Date.now() / 1000);
		if (currentTime - data.auth_date > 600) {
			return error(400, 'Stale data, please restart the app');
		}

		if (
			!data.user ||
			typeof data.user.id !== 'number' ||
			typeof data.user.first_name !== 'string'
		) {
			return error(400, 'Invalid user data: missing id or first_name');
		}

		const token = generateSecret(32);
		if (!token) {
			return error(500, 'Failed to generate token');
		}

		const tokenHash = await sha256(token);
		if (!tokenHash) {
			return error(500, 'Failed to generate tokenHash');
		}

		const result = await db.saveUserAndToken(env.D1_DATABASE, data.user, data.auth_date, tokenHash);

		if (!result.success) {
			return error(500, 'Failed to save user and token to database');
		}

		const user = await db.getUser(env.D1_DATABASE, data.user.id);
		if (user === null) {
			return error(500, 'Failed to retrieve user after saving');
		}

		return {
			token,
			start_param: data.start_param ?? null,
			start_page: data.start_param ? 'calendar' : 'home',
			user,
		} satisfies InitResponse;
	})

	.get('/', () => 'This telegram bot is deployed correctly. No user-serviceable parts inside.')

	.get('/miniApp/me', async ({ env, headers }) => {
		const suppliedToken = headers.get('Authorization')?.replace('Bearer ', '');
		if (!suppliedToken) {
			return error(401, 'Unauthorized: No token provided');
		}
		const tokenHash = await sha256(suppliedToken);
		const user = await db.getUserByTokenHash(env.D1_DATABASE, tokenHash);

		if (user === null) {
			return error(401, 'Unauthorized');
		}

		return { user };
	})

	.get('/miniApp/calendar/:ref', async ({ env, params }) => {
		const { ref } = params;
		const calendar = await db.getCalendarByRef(env.D1_DATABASE, ref);

		if (calendar === null) {
			return error(404, 'Calendar not found');
		}

		return { calendar: JSON.parse(calendar) };
	})

	.post('/miniApp/dates', async ({ telegram, env, bot_name, is_localhost, headers, ctx, json }) => {
		const suppliedToken = headers.get('Authorization')?.replace('Bearer ', '');
		if (!suppliedToken) {
			return error(401, 'Unauthorized: No token provided');
		}
		const tokenHash = await sha256(suppliedToken);
		const user = await db.getUserByTokenHash(env.D1_DATABASE, tokenHash);

		if (user === null) {
			return error(401, 'Unauthorized');
		}

		const ref = generateReference(8);
		const { dates } = await json<DatesRequest>();

		if (!dates || dates.length > 100) {
			return error(400, 'Invalid or too many dates');
		}

		for (const date of dates) {
			if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
				return error(400, 'Invalid date format');
			}
		}

		const jsonToSave = JSON.stringify({ dates });
		const result = await db.saveCalendar(env.D1_DATABASE, jsonToSave, ref, user.id);
		if (!result.success) {
			return error(500, 'Failed to save calendar');
		}

		const messageSender = new MessageSender(
			{ telegram, is_localhost, bot_name, env, ctx },
			user.language_code
		);

		// Use Cloudflare Workers' ExecutionContext for background processing
		ctx.waitUntil(messageSender.sendCalendarLink(user.telegram_id, user.first_name, ref));

		return { user };
	})

	.post('/telegramMessage', async ({ env, headers, json }) => {
		const telegramProvidedToken = headers.get('X-Telegram-Bot-Api-Secret-Token');
		const savedToken = await db.getSetting(env.D1_DATABASE, 'telegram_security_code');
		if (savedToken === null) {
			return error(500, 'Token not found');
		}
		if (telegramProvidedToken !== savedToken) {
			return error(401, 'Unauthorized');
		}

		const messageJson = await json<TelegramUpdate>();
		await processMessage(messageJson, { env } as App);

		return 'Success';
	})

	.get('/updateTelegramMessages', async ({ telegram, env, is_localhost, ctx }) => {
		if (!is_localhost) {
			return error(403, 'This request is only supposed to be used locally');
		}

		const lastUpdateId = await db.getLatestUpdateId(env.D1_DATABASE);
		const updates = await telegram.getUpdates(lastUpdateId);

		// Use Cloudflare Workers' ExecutionContext for background processing
		ctx.waitUntil(
			(async () => {
				for (const update of updates.result) {
					await processMessage(update, { env, telegram } as App);
				}
			})()
		);

		return {
			lastUpdateId,
			updateCount: updates.result.length,
		};
	})

	.post('/init', async ({ telegram, env, bot_name, headers, json }) => {
		if (headers.get('Authorization') !== `Bearer ${env.INIT_SECRET}`) {
			return error(401, 'Unauthorized');
		}

		let token = await db.getSetting(env.D1_DATABASE, 'telegram_security_code');

		if (token === null) {
			token = crypto.getRandomValues(new Uint8Array(16)).join('');
			const result = await db.setSetting(env.D1_DATABASE, 'telegram_security_code', token);
			if (!result.success) {
				return error(500, 'Failed to set setting');
			}
		}

		const { externalUrl } = await json<{ externalUrl: string }>();
		const response = await telegram.setWebhook(`${externalUrl}/telegramMessage`, token);

		return `Success! Bot Name: https://t.me/${bot_name}. Webhook status: ${JSON.stringify(response)}`;
	});

export default router;
