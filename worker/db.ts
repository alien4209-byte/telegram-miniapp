import type { Env, ScoreRow, UserRow } from "./types";
import type { TelegramUser } from "./telegram";

/** Finds an existing user by telegram_id, or creates one. Returns the D1 row. */
export async function getOrCreateUser(env: Env, tgUser: TelegramUser): Promise<UserRow> {
  const existing = await env.D1_DATABASE
    .prepare("SELECT * FROM users WHERE telegram_id = ?")
    .bind(tgUser.id)
    .first<UserRow>();

  if (existing) {
    // Keep profile fields fresh (name/username can change on Telegram's side).
    await env.D1_DATABASE
      .prepare(
        "UPDATE users SET first_name = ?, last_name = ?, username = ?, language_code = ? WHERE telegram_id = ?"
      )
      .bind(
        tgUser.first_name ?? null,
        tgUser.last_name ?? null,
        tgUser.username ?? null,
        tgUser.language_code ?? null,
        tgUser.id
      )
      .run();
    return { ...existing, first_name: tgUser.first_name ?? null, last_name: tgUser.last_name ?? null };
  }

  const inserted = await env.D1_DATABASE
    .prepare(
      "INSERT INTO users (telegram_id, first_name, last_name, username, language_code) VALUES (?, ?, ?, ?, ?) RETURNING *"
    )
    .bind(
      tgUser.id,
      tgUser.first_name ?? null,
      tgUser.last_name ?? null,
      tgUser.username ?? null,
      tgUser.language_code ?? null
    )
    .first<UserRow>();

  if (!inserted) throw new Error("Failed to create user");

  // Every user gets a scores row so leaderboard queries can always LEFT/INNER join cleanly.
  await env.D1_DATABASE
    .prepare("INSERT INTO scores (user_id, wins, losses, games_played) VALUES (?, 0, 0, 0)")
    .bind(inserted.id)
    .run();

  return inserted;
}

export async function getUserByTelegramId(env: Env, telegramId: number): Promise<UserRow | null> {
  return env.D1_DATABASE
    .prepare("SELECT * FROM users WHERE telegram_id = ?")
    .bind(telegramId)
    .first<UserRow>();
}

interface RecordGameParams {
  gameId: string;
  roomId: string;
  players: { id: string; name: string; telegramId?: number }[];
  winner: "team1" | "team2";
  scoreTeam1: number;
  scoreTeam2: number;
}

/** Persists a finished game's result to the `games` table. */
export async function recordGameResult(env: Env, params: RecordGameParams): Promise<void> {
  await env.D1_DATABASE
    .prepare(
      `INSERT INTO games (id, room_id, players, winner, score_team1, score_team2, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .bind(
      params.gameId,
      params.roomId,
      JSON.stringify(params.players),
      params.winner,
      params.scoreTeam1,
      params.scoreTeam2
    )
    .run();
}

/** Increments wins/losses/games_played for a user based on whether their team won. */
export async function updateUserScore(env: Env, telegramId: number, won: boolean): Promise<void> {
  const user = await getUserByTelegramId(env, telegramId);
  if (!user) return;

  const existing = await env.D1_DATABASE
    .prepare("SELECT * FROM scores WHERE user_id = ?")
    .bind(user.id)
    .first<ScoreRow>();

  if (!existing) {
    await env.D1_DATABASE
      .prepare("INSERT INTO scores (user_id, wins, losses, games_played) VALUES (?, ?, ?, 1)")
      .bind(user.id, won ? 1 : 0, won ? 0 : 1)
      .run();
    return;
  }

  await env.D1_DATABASE
    .prepare(
      "UPDATE scores SET wins = wins + ?, losses = losses + ?, games_played = games_played + 1 WHERE user_id = ?"
    )
    .bind(won ? 1 : 0, won ? 0 : 1, user.id)
    .run();
}

export interface LeaderboardEntry {
  name: string;
  wins: number;
  losses: number;
  games_played: number;
}

export async function getLeaderboard(env: Env, limit = 10): Promise<LeaderboardEntry[]> {
  const result = await env.D1_DATABASE
    .prepare(
      `SELECT COALESCE(u.username, u.first_name, 'بازیکن') AS name, s.wins, s.losses, s.games_played
       FROM scores s
       JOIN users u ON u.id = s.user_id
       ORDER BY s.wins DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<LeaderboardEntry>();

  return result.results ?? [];
}
