import { getGreetingMessage } from '@/locales/greetingMessages';
import { getCalendarLinkMessage, getCalendarShareMessage } from '@/locales/calendarMessages';
import { Telegram } from '@/telegram';
import { App, LanguageTag } from '@/types/types';
import { error } from 'itty-router';

class MessageSender {
	private botName: string;
	private telegram: Telegram;
	private language: LanguageTag;
	private ctx: ExecutionContext;

	constructor(app: App, language: LanguageTag = 'en') {
		this.botName = app.bot_name ?? '';
		this.telegram = app.telegram;
		this.language = language;
		this.ctx = app.ctx;
	}

	setLanguage(language: LanguageTag): void {
		this.language = language;
	}

	async sendMessage(
		chatId: number | string,
		text: string,
		reply_to_message_id?: number
	): Promise<any> {
		try {
			return await this.telegram.sendMessage(chatId, text, 'MarkdownV2', reply_to_message_id);
		} catch (err) {
			throw error(500, 'Failed to send message');
		}
	}

	async sendGreeting(chatId: number | string, replyToMessageId?: number): Promise<void> {
		const message = getGreetingMessage(this.language, this.botName);
		const sendPromise = this.sendMessage(chatId, message, replyToMessageId);
		this.ctx.waitUntil(sendPromise);
		// allow the greeting to be sent in the background
	}

	async sendCalendarLink(
		chatId: number | string,
		userName: string | null,
		calendarRef: string
	): Promise<any> {
		const linkMessage = getCalendarLinkMessage(this.language);
		await this.sendMessage(chatId, linkMessage);
		const shareMessage = getCalendarShareMessage(
			this.language,
			userName,
			this.botName,
			calendarRef
		);
		return this.ctx.waitUntil(this.sendMessage(chatId, shareMessage));
	}
}

export { MessageSender };
