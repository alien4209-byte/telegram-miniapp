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

		const command = json.message.text;

		switch (command) {
			case '/start':
				ctx.waitUntil(
					sendGreeting(
						app.telegramConfig,
						languageCode as LanguageTag,
						app.bot_name,
						chatId,
						replyToMessageId
					)
				);
				return 'Greeting sent';

			case '/info':
				ctx.waitUntil(
					sendGreeting(
						app.telegramConfig,
						languageCode as LanguageTag,
						app.bot_name,
						chatId,
						replyToMessageId
					)
				);
				return 'Info sent';

			// Add more cases as needed

			default:
				return 'Skipped message';
		}
	} catch (error) {
		return 'Error processing message';
	}
};

export { processMessage };
