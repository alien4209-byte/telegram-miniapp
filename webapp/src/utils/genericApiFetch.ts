import { NetworkError, handleApiError } from './apiErrorHandling';
import { RetryOptions } from '@/types/types';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || '';

if (!BACKEND_URL || !BACKEND_URL.startsWith('https://')) {
	throw new Error('Invalid or missing VITE_BACKEND_URL environment variable');
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
	maxRetries: 3,
	retryDelay: 1000,
	retryOn: error => error instanceof NetworkError,
};

export const apiFetch = async <T>(
	endpoint: string,
	options: RequestInit = {},
	retryOptions: Partial<RetryOptions> = {}
): Promise<T> => {
	const { maxRetries, retryDelay, retryOn } = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };

	let lastError: Error;
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(`${BACKEND_URL}${endpoint}`, {
				...options,
				mode: 'cors',
				headers: {
					...options.headers,
				},
			});
			if (!response.ok) {
				await handleApiError(response);
			}
			return response.json();
		} catch (error) {
			lastError = error as Error;
			if (attempt === maxRetries || !retryOn(lastError)) {
				throw lastError;
			}
			await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
		}
	}
	throw lastError!;
};
