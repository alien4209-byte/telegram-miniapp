enum StartPage {
	Calendar = 'calendar',
	Home = 'home',
}

export interface RetryOptions {
	maxRetries: number;
	retryDelay: number;
	retryOn: (error: Error) => boolean;
}

export interface APIErrorResponse {
	message: string;
	code?: string;
	errors?: Record<string, string[]>;
}

export interface RetryOptions {
	maxRetries: number;
	retryDelay: number;
	retryOn: (error: Error) => boolean;
}

export interface TelegramInitData {
	init_data_raw: string;
}

export interface User {
	id: number;
	created_date: string;
	updated_date: string;
	last_auth_timestamp: number;
	telegram_id: number;
	is_bot: boolean;
	first_name: string | null;
	last_name: string | null;
	username: string | null;
	language_code: string | null;
	is_premium: boolean;
	added_to_attachment_menu: boolean;
	allows_write_to_pm: boolean;
	photo_url: string | null;
}

export interface InitMiniAppResponse {
	token: string | null;
	start_param?: string | null;
	start_page: StartPage;
	user: User;
}

export interface SendDatesResponse {
	success: boolean;
	user: User;
}

/*export interface CalendarType {
	id: number;
	created_date: string;
	updated_date: string;
	user_id: number;
	calendar_json: {
		dates: string[];
	};
	calendar_ref: string;
}*/

export interface CalendarType {
	dates: string[];
}

export interface CalendarProps {
	apiRef: string;
}
