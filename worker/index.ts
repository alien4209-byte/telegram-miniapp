import { AutoRouter, error, cors, IRequest } from 'itty-router';
import { Telegram } from '@/telegram';
import * as db from '@/db';
import { processMessage } from '@/messageProcessor';
import { MessageSender } from '@/messageSender';
import { generateSecret, sha256 } from '@/cryptoUtils';
import {
	App,
	Env,
	TelegramUpdate,
	InitResponse,
	IncomingInitData,
	DatesRequest,
} from '@/types/types';

// Define the extended request type
type ExtendedRequest = IRequest & App;

// Create an AutoRouter with correct types
const router = AutoRouter<ExtendedRequest, [Env, ExecutionContext]>({
	base: '/',
	before: [
		async (request, env, ctx) => {
			// Set up CORS handling
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
					await db.setSetting(env.D1_DATABASE, 'bot_name', bot_name);
				} else {
					throw error(500, 'Failed to get bot username');
				}
			}

			// Extend the request with our custom App properties
			Object.assign(request, { telegram, is_localhost, bot_name, env, ctx, corsify });
		},
	],
	catch: error,
	missing: () => error(404, 'Not Found'),
	finally: [
		(response, request) => {
			// Apply CORS headers to all responses
			return request.corsify ? request.corsify(response) : response;
		},
	],
});

// Routes
router
	.get('/', () => 'This telegram bot is deployed correctly. No user-serviceable parts inside.')

	.post('/miniApp/init', async ({ telegram, env, json }) => {
		const incomingData = await json<IncomingInitData>();

		if (typeof incomingData?.init_data_raw !== 'string') {
			throw error(400, 'Invalid initDataRaw');
		}

		const { expected_hash, calculated_hash, data } = await telegram.calculateHashes(
			incomingData.init_data_raw
		);

		console.log('Expected: ' + expected_hash);
		console.log('Calculated: ' + calculated_hash);
		if (expected_hash !== calculated_hash) {
			throw error(401, 'Unauthorized');
		}

		const currentTime = Math.floor(Date.now() / 1000);
		if (currentTime - data.auth_date > 600) {
			throw error(400, 'Stale data, please restart the app');
		}

		if (!data.user || typeof data.user.id !== 'number') {
			throw error(400, 'Invalid user data');
		}

		const token = generateSecret(16);
		console.log('token: ', token);
		if (!token) {
			throw error(500, 'Failed to generate token');
		}

		const tokenHash = await sha256(token);
		console.log('tokenHash: ', tokenHash);
		await db.saveUserAndToken(env.D1_DATABASE, data.user, data.auth_date, tokenHash);

		const user = await db.getUser(env.D1_DATABASE, data.user.id);
		console.log('user: ', user);

		return {
			token,
			start_param: data.start_param ?? null,
			start_page: data.start_param ? 'calendar' : 'home',
			user,
		} satisfies InitResponse;
	})

	.get('/miniApp/me', async ({ env, headers }) => {
		const suppliedToken = headers.get('Authorization')?.replace('Bearer ', '');
		if (!suppliedToken) {
			throw error(401, 'Unauthorized: No token provided');
		}
		const tokenHash = await sha256(suppliedToken);
		const user = await db.getUserByTokenHash(env.D1_DATABASE, tokenHash);

		if (user === null) {
			throw error(401, 'Unauthorized');
		}

		return { user };
	})

	.get('/miniApp/calendar/:ref', async ({ env, params }) => {
		const { ref } = params;
		const calendar = await db.getCalendarByRef(env.D1_DATABASE, ref);

		if (calendar === null) {
			throw error(404, 'Not found');
		}

		return { calendar: JSON.parse(calendar) };
	})

	.post('/miniApp/dates', async ({ telegram, env, bot_name, is_localhost, headers, ctx, json }) => {
		const suppliedToken = headers.get('Authorization')?.replace('Bearer ', '');
		if (!suppliedToken) {
			throw error(401, 'Unauthorized: No token provided');
		}
		const tokenHash = await sha256(suppliedToken);
		const user = await db.getUserByTokenHash(env.D1_DATABASE, tokenHash);

		if (user === null) {
			throw error(401, 'Unauthorized');
		}

		const ref = generateSecret(8);
		const { dates } = await json<DatesRequest>();

		if (!dates || dates.length > 100) {
			throw error(400, 'Invalid or too many dates');
		}

		for (const date of dates) {
			if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
				throw error(400, 'Invalid date format');
			}
		}

		const jsonToSave = JSON.stringify({ dates });
		await db.saveCalendar(env.D1_DATABASE, jsonToSave, ref, user.id);

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

		if (telegramProvidedToken !== savedToken) {
			throw error(401, 'Unauthorized');
		}

		const messageJson = await json<TelegramUpdate>();
		await processMessage(messageJson, { env } as App);

		return 'Success';
	})

	.get('/updateTelegramMessages', async ({ telegram, env, is_localhost, ctx }) => {
		if (!is_localhost) {
			throw error(403, 'This request is only supposed to be used locally');
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
			throw error(401, 'Unauthorized');
		}

		let token = await db.getSetting(env.D1_DATABASE, 'telegram_security_code');

		if (token === null) {
			token = crypto.getRandomValues(new Uint8Array(16)).join('');
			await db.setSetting(env.D1_DATABASE, 'telegram_security_code', token);
		}

		const { externalUrl } = await json<{ externalUrl: string }>();
		const response = await telegram.setWebhook(`${externalUrl}/telegramMessage`, token);

		return `Success! Bot Name: https://t.me/${bot_name}. Webhook status: ${JSON.stringify(response)}`;
	});

export default router;
