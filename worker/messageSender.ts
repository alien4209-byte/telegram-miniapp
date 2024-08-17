import { getGreetingMessage } from '@/locales/greetingMessages';
import { getCalendarLinkMessage, getCalendarShareMessage } from '@/locales/calendarMessages';
import { Telegram } from '@/telegram';
import { LanguageTag } from '@/types/types';
import { error } from 'itty-router';

async function sendMessage(
	telegram: Telegram,
	chatId: number | string,
	text: string,
	reply_to_message_id?: number
): Promise<any> {
	try {
		return await telegram.sendMessage(chatId, text, 'MarkdownV2', reply_to_message_id);
	} catch (err) {
		throw error(500, 'Failed to send message');
	}
}

export async function sendGreeting(
	telegram: Telegram,
	language: LanguageTag,
	bot_name: string,
	chatId: number | string,
	replyToMessageId?: number
): Promise<void> {
	const message = getGreetingMessage(language, bot_name);
	try {
		await sendMessage(telegram, chatId, message, replyToMessageId);
	} catch (error) {
		throw error;
	}
}

export async function sendInfo(
	telegram: Telegram,
	language: LanguageTag,
	bot_name: string,
	chatId: number | string,
	replyToMessageId?: number
): Promise<void> {
	const message = getGreetingMessage(language, bot_name);
	try {
		await sendMessage(telegram, chatId, message, replyToMessageId);
	} catch (error) {
		throw error;
	}
}

export async function sendCalendarLink(
	telegram: Telegram,
	language: LanguageTag,
	bot_name: string,
	ctx: ExecutionContext,
	chatId: number | string,
	userName: string | null,
	calendarRef: string
): Promise<void> {
	const linkMessage = getCalendarLinkMessage(language);
	await sendMessage(telegram, chatId, linkMessage);
	const shareMessage = getCalendarShareMessage(language, userName, bot_name, calendarRef);
	ctx.waitUntil(sendMessage(telegram, chatId, shareMessage));
}
