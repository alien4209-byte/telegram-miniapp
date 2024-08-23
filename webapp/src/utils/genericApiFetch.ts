import {
	NetworkError,
	handleApiError,
	ValidationError,
	AuthenticationError,
	ForbiddenError,
	APIError,
} from './apiErrorHandling';
import { RetryOptions } from '@/types/Types';

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
				if (lastError instanceof ValidationError) {
					console.error('Validation error:', lastError.errors);
					// Here you might want to update your UI to show validation errors
				} else if (lastError instanceof AuthenticationError) {
					console.error('Authentication error:', lastError.message);
					// Here you might want to redirect to login or refresh token
				} else if (lastError instanceof ForbiddenError) {
					console.error('Forbidden error:', lastError.message);
					// Here you might want to show a "not authorized" message
				} else if (lastError instanceof APIError) {
					console.error('API error:', lastError.status, lastError.statusText, lastError.data);
					// Here you might want to show a generic error message
				} else if (lastError instanceof NetworkError) {
					console.error('Network error:', lastError.originalError);
					// Here you might want to show a "check your connection" message
				}
				throw lastError;
			}
			await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
		}
	}
	throw lastError!;
};
