import { hmacSha256, hex } from '@/utils/crypto';
import { CalculateHashesResult } from '@/types/types';
import { error } from 'itty-router';

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org/bot';

export type TelegramConfig = {
	token: string;
	useTestApi?: boolean;
};

const getApiUrl = (config: TelegramConfig, method: string): string =>
	`${TELEGRAM_API_BASE_URL}${config.token}/${config.useTestApi ? 'test/' : ''}${method}`;

export const calculateHashes = async (
	config: TelegramConfig,
	initData: string
): Promise<CalculateHashesResult> => {
	const urlParams = new URLSearchParams(initData);
	const expected_hash = urlParams.get('hash') || '';
	urlParams.delete('hash');
	urlParams.sort();

	const dataCheckString = [...(urlParams as unknown as Iterable<[string, string]>)]
		.map(([key, value]) => `${key}=${value}`)
		.join('\n');

	const data: Record<string, any> = {};
	urlParams.forEach((value, key) => {
		if (['user', 'receiver', 'chat'].includes(key)) {
			try {
				data[key] = JSON.parse(value);
			} catch (error) {
				console.error(`Failed to parse ${key}:`, error);
				data[key] = value;
			}
		} else if (key === 'auth_date') {
			data[key] = parseInt(value, 10);
		} else {
			data[key] = value;
		}
	});

	const secretKey = await hmacSha256(config.token, 'WebAppData');
	const calculated_hash = hex(await hmacSha256(dataCheckString, secretKey));

	return {
		expected_hash,
		calculated_hash,
		data: data as CalculateHashesResult['data'],
	};
};

export const getUpdates = async (config: TelegramConfig, lastUpdateId?: number): Promise<any> => {
	const params: any = lastUpdateId ? { offset: lastUpdateId + 1 } : {};
	const response = await fetch(getApiUrl(config, 'getUpdates'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params),
	});

	if (!response.ok) {
		throw error(response.status, 'Failed to get updates from Telegram API');
	}
	return response.json();
};

export const sendMessage = async (
	config: TelegramConfig,
	chatId: number | string,
	text: string,
	parse_mode?: string,
	reply_to_message_id?: number
): Promise<any> => {
	const response = await fetch(getApiUrl(config, 'sendMessage'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			chat_id: chatId,
			text,
			parse_mode,
			reply_to_message_id,
		}),
	});

	if (!response.ok) {
		throw error(response.status, 'Failed to send message');
	}
	return response.json();
};

export const setWebhook = async (
	config: TelegramConfig,
	external_url: string,
	secret_token?: string
): Promise<any> => {
	const params: any = { url: external_url };
	if (secret_token) {
		params.secret_token = secret_token;
	}

	const response = await fetch(getApiUrl(config, 'setWebhook'), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params),
	});

	if (!response.ok) {
		throw error(response.status, 'Failed to set webhook');
	}
	return response.json();
};

export const getMe = async (config: TelegramConfig): Promise<any> => {
	const response = await fetch(getApiUrl(config, 'getMe'), {
		method: 'GET',
		headers: { 'Content-Type': 'application/json' },
	});

	if (!response.ok) {
		throw error(response.status, 'Failed to get bot information');
	}
	return response.json();
};
