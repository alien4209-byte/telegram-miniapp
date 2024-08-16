import { sendGreeting } from '@/messageSender';
import { App, LanguageTag, TelegramUpdate } from '@/types/types';
import * as db from '@/db';

const processMessage = async (json: TelegramUpdate, app: App): Promise<string> => {
	const { env, ctx } = app;

	// Early return if message is undefined
	if (!json.message) {
		console.log('Received update without message:', JSON.stringify(json));
		return 'Update without message';
	}

	const chatId = json.message.chat.id;
	const replyToMessageId = json.message.message_id;
	const languageCode = json.message.from?.language_code;

	try {
		const messageToSave = JSON.stringify(json, null, 2);
		await db.addMessage(env.D1_DATABASE, messageToSave, json.update_id);

		if (json.message.text === '/start') {
			const sendingPromise = sendGreeting(
				app.telegram,
				languageCode as LanguageTag,
				app.bot_name,
				chatId,
				replyToMessageId
			);
			ctx.waitUntil(sendingPromise);
			return 'Greeting sent';
		}

		return 'Skipped message';
	} catch (error) {
		console.error('Error processing message:', error);
		return 'Error processing message';
	}
};

export { processMessage };
