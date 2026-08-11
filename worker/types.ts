// Shared types across the Worker, the HokmGameRoom Durable Object, D1 helpers,
// and the Telegram integration.

export interface Env {
  HOKM_GAME_ROOM: DurableObjectNamespace;
  D1_DATABASE: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  // No longer enforced (group restriction was removed), kept optional in case
  // you want to reintroduce it later.
  ALLOWED_GROUP_ID?: string;
  FRONTEND_URL: string;
  // Optional: set via `wrangler secret put TELEGRAM_WEBHOOK_SECRET` and configure the same
  // value when registering the webhook (setWebhook's secret_token) to authenticate callbacks.
  TELEGRAM_WEBHOOK_SECRET?: string;
  // Optional: dedicated signing secret for miniApp/init tokens. Falls back to
  // TELEGRAM_BOT_TOKEN if not set, but a separate secret is recommended.
  AUTH_TOKEN_SECRET?: string;
}

// ---- Game domain types ----

export type Suit = "♠" | "♥" | "♦" | "♣";
export type CardCode = string; // e.g. "♠A", "♥10"

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
] as const;
export type Rank = (typeof RANKS)[number];

export const MAX_PLAYERS = 4;
export const TRICKS_PER_HAND = 13;
export const TRICKS_TO_WIN_HAND = 7; // majority of 13
export const HANDS_TO_WIN_MATCH = 7;
// Minimum real (non-bot) players before "start with bots" is allowed.
export const MIN_PLAYERS_TO_START_WITH_BOTS = 2;

export interface RoomPlayer {
  id: string;
  name: string;
  seat: number; // 0..3, assigned in join order; team1 = seats 0 & 2, team2 = seats 1 & 3
  isBot?: boolean;
}

export interface GamePlayerState {
  id: string;
  name: string;
  tricks: number;
  isActive: boolean;
  isBot?: boolean;
}

export interface TrickCard {
  playerId: string;
  card: CardCode;
}

export type GamePhase = "waiting" | "trump_selection" | "playing" | "finished";

export interface GameState {
  phase: GamePhase;
  deck: CardCode[];
  hands: CardCode[][]; // indexed by seat (0..3)
  trumpSuit: Suit | null;
  currentTrick: TrickCard[];
  currentPlayerIndex: number; // seat index whose turn it is
  hakemIndex: number; // seat index of the current hand's Hakem
  trickCount: number; // tricks completed so far in the current hand
  scores: { team1: number; team2: number }; // hands (rounds) won, match is first to 7
  players: GamePlayerState[]; // indexed by seat
}

// ---- WebSocket protocol: Client -> Server ----

export type ClientMessage =
  | { type: "join"; playerName: string }
  | { type: "set_trump"; suit: Suit }
  | { type: "play_card"; card: CardCode }
  | { type: "start_with_bots" }
  | { type: "leave" };

// ---- WebSocket protocol: Server -> Client (all user-facing text in Persian) ----

export type ServerMessage =
  | { type: "lobby_update"; players: { id: string; name: string }[]; count: number; maxPlayers: number }
  | { type: "game_started"; data: { players: { id: string; name: string }[]; hakem: string } }
  | { type: "select_trump"; message: string; suits: Suit[] }
  | { type: "trump_set"; suit: Suit; message: string }
  | { type: "your_turn"; hand: CardCode[]; message: string }
  | { type: "card_played"; player: string; card: CardCode; trick: number }
  | { type: "trick_won"; winner: string; trickNumber: number; scores: { name: string; tricks: number }[] }
  | { type: "game_ended"; data: { team1: number; team2: number; winner: string } }
  | { type: "error"; message: string };

// ---- D1 row shapes ----

export interface UserRow {
  id: number;
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  language_code: string | null;
  created_at: string;
}

export interface GameRow {
  id: string;
  room_id: string;
  players: string; // JSON-encoded array
  winner: string | null;
  score_team1: number | null;
  score_team2: number | null;
  created_at: string;
  ended_at: string | null;
}

export interface ScoreRow {
  id: number;
  user_id: number;
  wins: number;
  losses: number;
  games_played: number;
}
