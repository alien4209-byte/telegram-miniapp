// Core domain types shared across the app.
// Card strings follow the backend's wire format: `${suit}${rank}`, e.g. "♠A", "♥10".

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export type CardCode = string; // e.g. "♠A"

export interface Player {
  id: string;
  name: string;
}

export interface TrickScoreEntry {
  name: string;
  tricks: number;
}

export type GamePhase =
  | "connecting"
  | "lobby"
  | "trump_selection"
  | "playing"
  | "game_over";

export interface PlayedCard {
  player: string;
  card: CardCode;
}

export interface GameState {
  phase: GamePhase;
  connectionOk: boolean;

  // Lobby
  players: Player[];
  playerCount: number;
  requiredPlayers: number;

  // Identity
  selfName: string | null;
  selfId: string | null;

  // Trump selection
  hakem: string | null;
  isHakem: boolean;
  availableSuits: Suit[];
  trumpSuit: Suit | null;

  // Gameplay
  hand: CardCode[];
  currentTrick: PlayedCard[];
  trickNumber: number;
  currentTurnPlayer: string | null;
  isMyTurn: boolean;
  lastTrickWinner: string | null;
  scores: TrickScoreEntry[];

  // Team scores (round wins), team1 = hakem's team by convention
  team1Score: number;
  team2Score: number;

  // Game end
  winnerTeam: "team1" | "team2" | null;

  // UI feedback
  errorMessage: string | null;
  statusMessage: string | null;
}

// ---- WebSocket outgoing message shapes ----

export type OutgoingMessage =
  | { type: "join"; playerName: string }
  | { type: "set_trump"; suit: Suit }
  | { type: "play_card"; card: CardCode };

// ---- WebSocket incoming message shapes ----

export interface GameStartedMessage {
  type: "game_started";
  data: { players: Player[]; hakem: string };
}

export interface SelectTrumpMessage {
  type: "select_trump";
  message: string;
  suits: Suit[];
}

export interface TrumpSetMessage {
  type: "trump_set";
  suit: Suit;
  message: string;
}

export interface YourTurnMessage {
  type: "your_turn";
  hand: CardCode[];
  message: string;
}

export interface CardPlayedMessage {
  type: "card_played";
  player: string;
  card: CardCode;
  trick: number;
}

export interface TrickWonMessage {
  type: "trick_won";
  winner: string;
  trickNumber: number;
  scores: TrickScoreEntry[];
}

export interface GameEndedMessage {
  type: "game_ended";
  data: { team1: number; team2: number; winner: string };
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

// Some backends may also send a lobby update as players trickle in.
export interface PlayerJoinedMessage {
  type: "player_joined";
  players: Player[];
  playerCount?: number;
  requiredPlayers?: number;
}

export type IncomingMessage =
  | GameStartedMessage
  | SelectTrumpMessage
  | TrumpSetMessage
  | YourTurnMessage
  | CardPlayedMessage
  | TrickWonMessage
  | GameEndedMessage
  | ErrorMessage
  | PlayerJoinedMessage
  | { type: string; [key: string]: unknown };
