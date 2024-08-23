export class APIError extends Error {
	constructor(
		public status: number,
		public statusText: string,
		public data?: any,
		public code?: string
	) {
		super(`API error: ${status} ${statusText}`);
		this.name = 'APIError';
	}
}

export class NetworkError extends Error {
	constructor(public originalError: Error) {
		super('Network error occurred');
		this.name = 'NetworkError';
	}
}

export class ValidationError extends Error {
	constructor(public errors: Record<string, string[]>) {
		super('Validation error occurred');
		this.name = 'ValidationError';
	}
}

export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AuthenticationError';
	}
}

export class ForbiddenError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ForbiddenError';
	}
}

export const handleApiError = async (response: Response): Promise<never> => {
	const data = await response.json().catch(() => null);

	switch (response.status) {
		case 400:
			if (data && data.errors) {
				throw new ValidationError(data.errors);
			}
			throw new APIError(response.status, 'Bad Request', data);
		case 401:
			throw new AuthenticationError(data?.message || 'Authentication failed');
		case 403:
			throw new ForbiddenError(data?.message || 'Access forbidden');
		case 404:
			throw new APIError(response.status, 'Resource not found', data);
		case 422:
			throw new ValidationError(data?.errors || {});
		default:
			throw new APIError(response.status, response.statusText, data, data?.code);
	}
};
