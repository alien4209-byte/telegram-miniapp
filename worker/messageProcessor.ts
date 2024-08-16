import { MessageSender } from '@/messageSender';
import { App, TelegramMessage, TelegramUpdate } from '@/types/types';
import * as db from '@/db';

const processMessage = async (json: TelegramUpdate, app: App): Promise<string> => {
	console.log('Processing message:', json.message.text);
	const { env, ctx } = app;
	const chatId = json.message.chat.id;
	const replyToMessageId = json.message.message_id;
	const languageCode = json.message?.from?.language_code;

	try {
		const messageToSave = JSON.stringify(json, null, 2);
		await db.addMessage(env.D1_DATABASE, messageToSave, json.update_id);
		console.log('Message saved to database');

		const messageSender = new MessageSender(app, languageCode);

		if (json.message.text === '/start') {
			console.log('Received /start command, sending greeting');
			const sendingPromise = messageSender.sendGreeting(chatId, replyToMessageId);
			ctx.waitUntil(sendingPromise);
			return 'Greeting sent';
		}

		console.log('Message skipped: not a /start command');
		return 'Skipped message';
	} catch (error) {
		console.error('Error in processMessage:', error);
		return 'Error processing message';
	}
};

export { processMessage };
