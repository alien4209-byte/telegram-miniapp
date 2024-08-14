import { Router, error, cors } from 'itty-router';
import { Telegram } from '@/telegram';
import * as db from '@/db';
import { processMessage } from '@/messageProcessor';
import { MessageSender } from '@/messageSender';
import { generateSecret, sha256 } from '@/cryptoUtils';
import {
	App,
	Env,
	TelegramUpdate,
	User,
	GetMe,
	InitResponse,
	CalculateHashesResult,
	IncomingInitData,
} from '@/types/types';
import { AppError } from './errorHandler';

const { preflight, corsify } = cors();

const router = Router<Request & App, [Env, ExecutionContext]>();

router.all('*', async (request, env: Env) => {
	const telegram = new Telegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_USE_TEST_API);
	const is_localhost = request.headers.get('Host')?.match(/^(localhost|127\.0\.0\.1)/) !== null;

	let bot_name = await db.getSetting(env.D1_DATABASE, 'bot_name');
	if (!bot_name) {
		const me = await telegram.getMe();
		bot_name = me.result?.username ?? null;
		if (bot_name) {
			await db.setSetting(env.D1_DATABASE, 'bot_name', bot_name);
		} else {
			console.error('Failed to get bot username');
		}
	}

	Object.assign(request, { telegram, is_localhost, bot_name, env });
});

router
	.all('*', preflight)
	.get('/', () => 'This telegram bot is deployed correctly. No user-serviceable parts inside.')

	.post('/miniApp/init', async request => {
		const { telegram, env } = request;
		const incomingData = (await request.json()) as IncomingInitData;

		if (typeof incomingData.init_data_raw !== 'string') {
			throw new AppError(400, 'Invalid initDataRaw');
		}

		const { expected_hash, calculated_hash, data } = await telegram.calculateHashes(
			incomingData.init_data_raw
		);

		if (expected_hash !== calculated_hash) {
			throw new AppError(401, 'Unauthorized');
		}

		const currentTime = Math.floor(Date.now() / 1000);
		if (currentTime - data.auth_date > 600) {
			throw new AppError(400, 'Stale data, please restart the app');
		}

		if (!data.user || typeof data.user.id !== 'number') {
			throw new AppError(400, 'Invalid user data');
		}

		const token = generateSecret(16);
		if (!token) {
			throw new AppError(500, 'Failed to generate token');
		}

		const tokenHash = await sha256(token);
		await db.saveUserAndToken(env.D1_DATABASE, data.user, data.auth_date, tokenHash);

		return {
			token,
			start_param: data.start_param ?? null,
			start_page: data.start_param ? 'calendar' : 'home',
			user: await db.getUser(env.D1_DATABASE, data.user.id),
		} satisfies InitResponse;
	})

	.get('/miniApp/me', async request => {
		const { env } = request;
		const suppliedToken = request.headers.get('Authorization')?.replace('Bearer ', '');
		const tokenHash = await sha256(suppliedToken || '');
		const user = await db.getUserByTokenHash(env.D1_DATABASE, tokenHash);

		if (user === null) {
			throw new AppError(401, 'Unauthorized');
		}

		return { user };
	})

	.get('/miniApp/calendar/:ref', async request => {
		const { env, params } = request;
		const { ref } = params;
		const calendar = await db.getCalendarByRef(env.D1_DATABASE, ref);

		if (calendar === null) {
			throw new AppError(404, 'Not found');
		}

		return { calendar: JSON.parse(calendar) };
	})

	.post('/miniApp/dates', async request => {
		const { telegram, env, bot_name, is_localhost, params } = request;
		const suppliedToken = request.headers.get('Authorization')?.replace('Bearer ', '');
		const tokenHash = await sha256(suppliedToken || '');
		const user = await db.getUserByTokenHash(env.D1_DATABASE, tokenHash);

		if (user === null) {
			throw new AppError(401, 'Unauthorized');
		}

		const ref = generateSecret(8);
		const { dates } = (await request.json()) as { dates: string[] };

		if (dates.length > 100) {
			throw new AppError(400, 'Too many dates');
		}

		for (const date of dates) {
			if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
				throw new AppError(400, 'Invalid date');
			}
		}

		const jsonToSave = JSON.stringify({ dates });
		await db.saveCalendar(env.D1_DATABASE, jsonToSave, ref, user.id);

		const messageSender = new MessageSender(
			{ telegram, bot_name, is_localhost, env, params },
			user.language_code
		);
		await messageSender.sendCalendarLink(user.telegram_id, user.first_name, ref);

		return { user };
	})

	.post('/telegramMessage', async request => {
		const { env } = request;
		const telegramProvidedToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
		const savedToken = await db.getSetting(env.D1_DATABASE, 'telegram_security_code');

		if (telegramProvidedToken !== savedToken) {
			throw new AppError(401, 'Unauthorized');
		}

		const messageJson = await request.json();
		await processMessage(messageJson as TelegramUpdate, request);

		return 'Success';
	})

	.get('/updateTelegramMessages', async request => {
		const { telegram, env, is_localhost } = request;
		if (!is_localhost) {
			throw new AppError(403, 'This request is only supposed to be used locally');
		}

		const lastUpdateId = await db.getLatestUpdateId(env.D1_DATABASE);
		const updates = await telegram.getUpdates(lastUpdateId);
		const results = [];

		for (const update of updates.result) {
			const result = await processMessage(update, request);
			results.push(result);
		}

		return {
			lastUpdateId,
			updates,
			results,
		};
	})

	.post('/init', async request => {
		const { telegram, env, bot_name } = request;
		if (request.headers.get('Authorization') !== `Bearer ${env.INIT_SECRET}`) {
			throw new AppError(401, 'Unauthorized');
		}

		let token = await db.getSetting(env.D1_DATABASE, 'telegram_security_code');

		if (token === null) {
			token = crypto.getRandomValues(new Uint8Array(16)).join('');
			await db.setSetting(env.D1_DATABASE, 'telegram_security_code', token);
		}

		const { externalUrl } = (await request.json()) as { externalUrl: string };
		const response = await telegram.setWebhook(`${externalUrl}/telegramMessage`, token);

		return `Success! Bot Name: https://t.me/${bot_name}. Webhook status: ${JSON.stringify(response)}`;
	});

router.all('*', () => error(404));

export default {
	fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
		router
			.handle(request, env, ctx)
			.then(corsify)
			.catch(err => {
				console.error(err);
				return error(err instanceof AppError ? err.statusCode : 500, err.message);
			}),
};
