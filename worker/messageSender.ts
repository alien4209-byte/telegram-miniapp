import { getGreetingMessage } from '@/locales/greetingMessages';
import { getCalendarLinkMessage, getCalendarShareMessage } from '@/locales/calendarMessages';
import { TelegramConfig, sendMessage } from '@/telegram';
import { LanguageTag } from '@/types/types';
import { error } from 'itty-router';

export async function sendGreeting(
	telegramConfig: TelegramConfig,
	language: LanguageTag,
	bot_name: string,
	chatId: number | string,
	replyToMessageId?: number
): Promise<void> {
	const message = getGreetingMessage(language, bot_name);
	try {
		await sendMessage(telegramConfig, chatId, message, 'MarkdownV2', replyToMessageId);
	} catch (err) {
		throw error(500, 'Failed to send greeting message');
	}
}

export async function sendInfo(
	telegramConfig: TelegramConfig,
	language: LanguageTag,
	bot_name: string,
	chatId: number | string,
	replyToMessageId?: number
): Promise<void> {
	const message = getGreetingMessage(language, bot_name);
	try {
		await sendMessage(telegramConfig, chatId, message, 'MarkdownV2', replyToMessageId);
	} catch (err) {
		throw error(500, 'Failed to send info message');
	}
}

export async function sendCalendarLink(
	telegramConfig: TelegramConfig,
	language: LanguageTag,
	bot_name: string,
	ctx: ExecutionContext,
	chatId: number | string,
	userName: string | null,
	calendarRef: string
): Promise<void> {
	const linkMessage = getCalendarLinkMessage(language);
	try {
		await sendMessage(telegramConfig, chatId, linkMessage, 'MarkdownV2');
		const shareMessage = getCalendarShareMessage(language, userName, bot_name, calendarRef);
		ctx.waitUntil(sendMessage(telegramConfig, chatId, shareMessage, 'MarkdownV2'));
	} catch (err) {
		throw error(500, 'Failed to send calendar link message');
	}
}
