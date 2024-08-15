import { MessageSender } from '@/messageSender';
import { App, TelegramMessage, TelegramUpdate } from '@/types/types';
import * as db from '@/db';

const processMessage = async (json: TelegramUpdate, app: App): Promise<string> => {
	const { telegram, env, ctx } = app;

	const chatId = json.message.chat.id;
	const replyToMessageId = json.message.message_id;
	const languageCode = json.message?.from?.language_code;

	const messageToSave = JSON.stringify(json, null, 2);
	await db.addMessage(env.D1_DATABASE, messageToSave, json.update_id);

	const messageSender = new MessageSender(app, languageCode);

	if (json.message.text === '/start') {
		ctx.waitUntil(messageSender.sendGreeting(chatId, replyToMessageId));
		return 'Greeting sent';
	}

	return 'Skipped message';
};

export { processMessage };
