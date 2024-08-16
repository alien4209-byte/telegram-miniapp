import { hmacSha256, hex } from '@/utils/crypto';
import { CalculateHashesResult } from '@/types/types';
import { error } from 'itty-router';

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org/bot';

class TelegramAPI {
	private token: string;
	private apiBaseUrl: string;

	constructor(token: string, useTestApi: boolean = false) {
		this.token = token;
		const testApiAddendum = useTestApi ? 'test/' : '';
		this.apiBaseUrl = `${TELEGRAM_API_BASE_URL}${token}/${testApiAddendum}`;
	}

	async calculateHashes(initData: string): Promise<CalculateHashesResult> {
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

		const secretKey = await hmacSha256(this.token, 'WebAppData');
		const calculated_hash = hex(await hmacSha256(dataCheckString, secretKey));

		return {
			expected_hash,
			calculated_hash,
			data: data as CalculateHashesResult['data'],
		};
	}

	async getUpdates(lastUpdateId?: number): Promise<any> {
		const url = `${this.apiBaseUrl}getUpdates`;
		const params: any = {};
		if (lastUpdateId) {
			params.offset = lastUpdateId + 1;
		}
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(params),
		});
		if (!response.ok) {
			throw error(response.status, 'Failed to get updates from Telegram API');
		}
		return response.json();
	}

	async sendMessage(
		chatId: number | string,
		text: string,
		parse_mode?: string,
		reply_to_message_id?: number
	): Promise<any> {
		const url = `${this.apiBaseUrl}sendMessage`;
		const body = JSON.stringify({
			chat_id: chatId,
			text: text,
			parse_mode: parse_mode,
			reply_to_message_id: reply_to_message_id,
		});
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: body,
		});
		if (!response.ok) {
			throw error(response.status, 'Failed to send message');
		}
		return response.json();
	}

	async setWebhook(external_url: string, secret_token?: string): Promise<any> {
		const params: any = {
			url: external_url,
		};
		if (secret_token) {
			params.secret_token = secret_token;
		}
		const url = `${this.apiBaseUrl}setWebhook`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(params),
		});
		if (!response.ok) {
			throw error(response.status, 'Failed to set webhook');
		}
		return response.json();
	}

	async getMe(): Promise<any> {
		const url = `${this.apiBaseUrl}getMe`;
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		if (!response.ok) {
			throw error(response.status, 'Failed to get bot information');
		}
		return response.json();
	}
}

export { TelegramAPI as Telegram };
