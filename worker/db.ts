import { D1Database, D1Result } from '@cloudflare/workers-types';
import { TelegramUser, User } from './types/types';
import { error } from 'itty-router';

export async function getSetting(db: D1Database, settingName: string): Promise<string | null> {
	try {
		return await db
			.prepare('SELECT value FROM settings WHERE name = ?')
			.bind(settingName)
			.first('value');
	} catch (err) {
		throw error(500, 'Failed to get setting from database');
	}
}

export async function setSetting(
	db: D1Database,
	settingName: string,
	settingValue: string
): Promise<D1Result<unknown>> {
	try {
		return await db
			.prepare(
				`
        INSERT INTO settings (created_date, updated_date, name, value)
        VALUES (DATETIME('now'), DATETIME('now'), ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          updated_date = DATETIME('now'),
          value = excluded.value
        WHERE excluded.value <> settings.value
      `
			)
			.bind(settingName, settingValue)
			.run();
	} catch (err) {
		throw error(500, 'Failed to set setting in database');
	}
}

export async function getLatestUpdateId(db: D1Database): Promise<number> {
	try {
		const result = await db
			.prepare('SELECT update_id FROM messages ORDER BY update_id DESC LIMIT 1')
			.first<{ update_id: string }>();

		return result ? Number(result.update_id) : 0;
	} catch (err) {
		throw error(500, 'Failed to get latest update ID from database');
	}
}

export async function addMessage(
	db: D1Database,
	message: string,
	updateId: number
): Promise<D1Result<unknown>> {
	try {
		return await db
			.prepare(
				`
        INSERT INTO messages (created_date, updated_date, message, update_id)
        VALUES (DATETIME('now'), DATETIME('now'), ?, ?)
      `
			)
			.bind(message, updateId.toString())
			.run();
	} catch (err) {
		throw error(500, 'Failed to add message to database');
	}
}

export async function getUser(db: D1Database, telegramId: number): Promise<User | null> {
	try {
		return await db
			.prepare('SELECT * FROM users WHERE telegram_id = ?')
			.bind(telegramId)
			.first<User>();
	} catch (err) {
		throw error(500, 'Failed to get user from database');
	}
}

export async function getUserByTokenHash(
	db: D1Database,
	tokenHash: Uint8Array
): Promise<User | null> {
	try {
		return await db
			.prepare(
				`
        SELECT u.*
        FROM users u
        JOIN tokens t ON u.id = t.user_id
        WHERE t.token_hash = ? AND t.expired_date > DATETIME('now')
        LIMIT 1
      `
			)
			.bind(tokenHash)
			.first<User>();
	} catch (err) {
		throw error(500, 'Failed to get user by token hash from database');
	}
}

export async function saveCalendar(
	db: D1Database,
	calendarJson: string,
	calendarRef: string,
	userId: number
): Promise<D1Result<unknown>> {
	try {
		return await db
			.prepare(
				`
        INSERT INTO calendars (created_date, updated_date, calendar_json, calendar_ref, user_id)
        VALUES (DATETIME('now'), DATETIME('now'), ?, ?, ?)
      `
			)
			.bind(calendarJson, calendarRef, userId)
			.run();
	} catch (err) {
		throw error(500, 'Failed to save calendar to database');
	}
}

export async function getCalendarByRef(
	db: D1Database,
	calendarRef: string
): Promise<string | null> {
	try {
		return await db
			.prepare('SELECT calendar_json FROM calendars WHERE calendar_ref = ?')
			.bind(calendarRef)
			.first('calendar_json');
	} catch (err) {
		throw error(500, 'Failed to get calendar from database');
	}
}

export async function saveUserAndToken(
	db: D1Database,
	user: TelegramUser,
	auth_timestamp: number,
	tokenHash: Uint8Array
): Promise<void> {
	try {
		await db.batch([
			db.prepare('BEGIN'),
			db
				.prepare(
					`
          INSERT INTO users (created_date, updated_date, last_auth_timestamp, telegram_id, is_bot, first_name, last_name, username, language_code, is_premium, added_to_attachment_menu, allows_write_to_pm, photo_url)
          VALUES (DATETIME('now'), DATETIME('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(telegram_id) DO UPDATE SET
            updated_date = DATETIME('now'),
            last_auth_timestamp = COALESCE(excluded.last_auth_timestamp, last_auth_timestamp),
            is_bot = COALESCE(excluded.is_bot, is_bot),
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            username = excluded.username,
            language_code = COALESCE(excluded.language_code, language_code),
            is_premium = COALESCE(excluded.is_premium, is_premium),
            added_to_attachment_menu = COALESCE(excluded.added_to_attachment_menu, added_to_attachment_menu),
            allows_write_to_pm = COALESCE(excluded.allows_write_to_pm, allows_write_to_pm),
            photo_url = COALESCE(excluded.photo_url, photo_url)
          WHERE excluded.last_auth_timestamp > users.last_auth_timestamp
        `
				)
				.bind(
					auth_timestamp,
					user.id,
					Number(user.is_bot),
					user.first_name,
					user.last_name || null,
					user.username || null,
					user.language_code || null,
					Number(user.is_premium),
					Number(user.added_to_attachment_menu),
					Number(user.allows_write_to_pm),
					user.photo_url || null
				),
			db
				.prepare(
					`
          INSERT INTO tokens (created_date, updated_date, expired_date, user_id, token_hash)
          VALUES (DATETIME('now'), DATETIME('now'), DATETIME('now', '+1 day'), (SELECT id FROM users WHERE telegram_id = ?), ?)
        `
				)
				.bind(user.id, tokenHash),
			db.prepare('COMMIT'),
		]);
	} catch (err) {
		throw error(500, 'Failed to save user and token to database');
	}
}
