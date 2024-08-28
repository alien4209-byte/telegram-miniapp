import { AutoRouter } from 'itty-router/AutoRouter';
import { error } from 'itty-router/error';
import { cors } from 'itty-router/cors';
import type { IRequest } from 'itty-router';
import { calculateHashes, getUpdates, sendMessage, setWebhook, getMe } from '@/telegram';
import * as db from '@/db';
import { processMessage } from '@/messageProcessor';
import { sendCalendarLink } from '@/messageSender';
import { generateSecret, sha256, generateReference } from '@/utils/crypto';
import {
	App,
	Env,
	TelegramUpdate,
	InitResponse,
	IncomingInitData,
	DatesRequest,
	LanguageTag,
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

			const telegramConfig = {
				token: env.TELEGRAM_BOT_TOKEN,
				useTestApi: env.TELEGRAM_USE_TEST_API,
			};
			const is_localhost = request.headers.get('Host')?.match(/^(localhost|127\.0\.0\.1)/) !== null;

			let bot_name = await db.getSetting(env.D1_DATABASE, 'bot_name');
			if (!bot_name) {
				const me = await getMe(telegramConfig);
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
			Object.assign(request, { telegramConfig, is_localhost, bot_name, env, ctx, corsify });
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
	.post('/miniApp/init', async ({ telegramConfig, env, json }) => {
		const incomingData = await json<IncomingInitData>();

		if (typeof incomingData?.init_data_raw !== 'string') {
			return error(400, 'Invalid initDataRaw');
		}
		console.log('Initdata obj:', incomingData);

		console.log('Initdata', incomingData.init_data_raw);

		const { expected_hash, calculated_hash, data } = await calculateHashes(
			telegramConfig,
			incomingData.init_data_raw
		);

		console.log('expected_hash:', expected_hash);

		console.log('calculated_hash', calculated_hash);

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

	.post(
		'/miniApp/dates',
		async ({ telegramConfig, env, bot_name, is_localhost, headers, ctx, json }) => {
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

			ctx.waitUntil(
				sendCalendarLink(
					telegramConfig,
					user.language_code as LanguageTag,
					bot_name,
					ctx,
					user.telegram_id,
					user.first_name,
					ref
				)
			);

			return { user };
		}
	)

	.post(
		'/telegramMessage',
		async ({ env, headers, json, telegramConfig, is_localhost, bot_name, ctx }) => {
			const telegramProvidedToken = headers.get('X-Telegram-Bot-Api-Secret-Token');
			const savedToken = await db.getSetting(env.D1_DATABASE, 'telegram_security_code');
			if (savedToken === null) {
				return error(500, 'Token not found');
			}
			if (telegramProvidedToken !== savedToken) {
				return error(401, 'Unauthorized');
			}

			const messageJson = await json<TelegramUpdate>();
			console.log('messageJson:', JSON.stringify(messageJson));

			const app: App = {
				telegramConfig,
				is_localhost,
				bot_name,
				env,
				ctx,
			};

			await processMessage(messageJson, app);

			return 'Success';
		}
	)

	.get('/updateTelegramMessages', async ({ telegramConfig, env, is_localhost, ctx }) => {
		if (!is_localhost) {
			return error(403, 'This request is only supposed to be used locally');
		}

		const lastUpdateId = await db.getLatestUpdateId(env.D1_DATABASE);
		const updates = await getUpdates(telegramConfig, lastUpdateId);

		// Use Cloudflare Workers' ExecutionContext for background processing
		ctx.waitUntil(
			(async () => {
				for (const update of updates.result) {
					await processMessage(update, { env, telegramConfig } as App);
				}
			})()
		);

		return {
			lastUpdateId,
			updateCount: updates.result.length,
		};
	})

	.post('/init', async ({ telegramConfig, env, bot_name, headers, json }) => {
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
		const response = await setWebhook(telegramConfig, `${externalUrl}/telegramMessage`, token);

		return `Success! Bot Name: https://t.me/${bot_name}. Webhook status: ${JSON.stringify(response)}`;
	});

export default router;
