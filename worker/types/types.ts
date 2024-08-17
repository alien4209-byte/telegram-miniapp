import { D1Database, ExecutionContext } from '@cloudflare/workers-types';
import { TelegramConfig } from '@/telegram';
import type * as dbTypes from '@/types/dbTypes';
export * from '@/types/dbTypes';

export interface App {
	telegramConfig: TelegramConfig;
	is_localhost: boolean;
	bot_name: string;
	env: Env;
	ctx: ExecutionContext;
}

// Env interface to extend Cloudflare's Env
export interface Env {
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_USE_TEST_API?: boolean;
	D1_DATABASE: D1Database;
	FRONTEND_URL: string;
	INIT_SECRET: string;
}

export interface IncomingInitData {
	init_data_raw: string;
}

export interface TelegramUser {
	id: number;
	is_bot?: boolean;
	first_name: string;
	last_name?: string;
	username?: string;
	language_code?: string;
	is_premium?: boolean;
	added_to_attachment_menu?: boolean;
	allows_write_to_pm?: boolean;
	photo_url?: string | null;
}

export interface TelegramMessage {
	message_id: number;
	message_thread_id?: number;
	from?: TelegramUser;
	sender_chat?: Chat;
	sender_boost_count?: number;
	sender_business_bot?: TelegramUser;
	date: number;
	business_connection_id?: string;
	chat: Chat;
	forward_origin?: any;
	is_topic_message?: true;
	is_automatic_forward?: true;
	reply_to_message?: TelegramMessage;
	external_reply?: any;
	quote?: any;
	reply_to_story?: any;
	via_bot?: TelegramUser;
	edit_date?: number;
	has_protected_content?: true;
	is_from_offline?: true;
	media_group_id?: string;
	author_signature?: string;
	text?: string;
	entities?: any[];
	link_preview_options?: any;
	effect_id?: string;
	animation?: any;
	audio?: any;
	document?: any;
	paid_media?: any;
	photo?: any[];
	sticker?: any;
	story?: any;
	video?: any;
	video_note?: any;
	voice?: any;
	caption?: string;
	caption_entities?: any[];
	show_caption_above_media?: true;
	has_media_spoiler?: true;
	contact?: any;
	dice?: any;
	game?: any;
	poll?: any;
	venue?: any;
	location?: any;
	new_chat_members?: TelegramUser[];
	left_chat_member?: TelegramUser;
	new_chat_title?: string;
	new_chat_photo?: any[];
	delete_chat_photo?: true;
	group_chat_created?: true;
	supergroup_chat_created?: true;
	channel_chat_created?: true;
	message_auto_delete_timer_changed?: any;
	migrate_to_chat_id?: number;
	migrate_from_chat_id?: number;
	pinned_message?: TelegramMessage;
	invoice?: any;
	successful_payment?: any;
	refunded_payment?: any;
	users_shared?: any;
	chat_shared?: any;
	connected_website?: string;
	write_access_allowed?: any;
	passport_data?: any;
	proximity_alert_triggered?: any;
	boost_added?: any;
	chat_background_set?: any;
	forum_topic_created?: any;
	forum_topic_edited?: any;
	forum_topic_closed?: any;
	forum_topic_reopened?: any;
	general_forum_topic_hidden?: any;
	general_forum_topic_unhidden?: any;
	giveaway_created?: any;
	giveaway?: any;
	giveaway_winners?: any;
	giveaway_completed?: any;
	video_chat_scheduled?: any;
	video_chat_started?: any;
	video_chat_ended?: any;
	video_chat_participants_invited?: any;
	web_app_data?: any;
	reply_markup?: any;
}

export interface TelegramUpdate {
	update_id: number;
	message?: TelegramMessage;
	edited_message?: TelegramMessage;
	channel_post?: TelegramMessage;
	edited_channel_post?: TelegramMessage;
	business_connection?: any;
	business_message?: TelegramMessage;
	edited_business_message?: TelegramMessage;
	deleted_business_messages?: any;
	message_reaction?: any;
	message_reaction_count?: any;
	inline_query?: any;
	chosen_inline_result?: any;
	callback_query?: any;
	shipping_query?: any;
	pre_checkout_query?: any;
	poll?: any;
	poll_answer?: any;
	my_chat_member?: any;
	chat_member?: any;
	chat_join_request?: any;
	chat_boost?: any;
	removed_chat_boost?: any;
}

export interface GetMe {
	ok: boolean;
	result: {
		id: number;
		is_bot: boolean;
		first_name: string;
		username: string;
		can_join_groups: boolean;
		can_read_all_group_messages: boolean;
		supports_inline_queries: boolean;
		can_connect_to_business: boolean;
		has_main_web_app: boolean;
	};
}

export interface Chat {
	id: number; // Ensure this field supports large numbers (64-bit safe)
	type: 'private' | 'group' | 'supergroup' | 'channel'; // Restrict to specific string values
	title?: string; // Optional for supergroups, channels, and group chats
	username?: string; // Optional for private chats, supergroups, and channels
	first_name?: string; // Optional for private chats
	last_name?: string; // Optional for private chats
	is_forum?: true; // Optional and only for supergroups that have forums (topics enabled)
}

export interface CalculateHashesResult {
	expected_hash: string;
	calculated_hash: string;
	data: {
		auth_date: number;
		chat_instance?: number;
		chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel' | string;
		receiver?: TelegramUser;
		chat?: Chat;
		start_param?: string | null;
		can_send_after?: number;
		query_id?: string;
		user?: TelegramUser;
	};
}

export interface InitResponse {
	token: string;
	start_param?: string | null;
	start_page: 'calendar' | 'home';
	user: dbTypes.User | null;
}

export interface DatesRequest {
	dates: string[];
}

export type LanguageTag = string | null;
