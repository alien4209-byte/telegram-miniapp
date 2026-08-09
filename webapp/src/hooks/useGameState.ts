import { create } from "zustand";
import type {
  CardPlayedMessage,
  GameEndedMessage,
  GameStartedMessage,
  GameState,
  IncomingMessage,
  PlayerJoinedMessage,
  SelectTrumpMessage,
  TrickWonMessage,
  TrumpSetMessage,
  YourTurnMessage,
} from "../types/game";
import { sortHand } from "../utils/cardHelpers";

interface GameStore extends GameState {
  setSelfName: (name: string) => void;
  setConnectionOk: (ok: boolean) => void;
  handleIncoming: (msg: IncomingMessage) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState: GameState = {
  phase: "connecting",
  connectionOk: false,

  players: [],
  playerCount: 0,
  requiredPlayers: 4,

  selfName: null,
  selfId: null,

  hakem: null,
  isHakem: false,
  availableSuits: [],
  trumpSuit: null,

  hand: [],
  currentTrick: [],
  trickNumber: 0,
  currentTurnPlayer: null,
  isMyTurn: false,
  lastTrickWinner: null,
  scores: [],

  team1Score: 0,
  team2Score: 0,

  winnerTeam: null,

  errorMessage: null,
  statusMessage: null,
};

export const useGameState = create<GameStore>()((set, get) => ({
  ...initialState,

  setSelfName: (name) => set({ selfName: name }),
  setConnectionOk: (ok) =>
    set((state) => ({
      connectionOk: ok,
      phase: ok && state.phase === "connecting" ? "lobby" : state.phase,
    })),

  clearError: () => set({ errorMessage: null }),

  reset: () => set({ ...initialState, connectionOk: get().connectionOk, selfName: get().selfName }),

  handleIncoming: (msg) => {
    switch (msg.type) {
      case "player_joined": {
        const m = msg as PlayerJoinedMessage;
        set({
          players: m.players,
          playerCount: m.playerCount ?? m.players.length,
          requiredPlayers: m.requiredPlayers ?? 4,
          phase: "lobby",
        });
        break;
      }

      case "game_started": {
        const m = msg as GameStartedMessage;
        const selfName = get().selfName;
        set({
          phase: "trump_selection",
          players: m.data.players,
          playerCount: m.data.players.length,
          hakem: m.data.hakem,
          isHakem: !!selfName && selfName === m.data.hakem,
          statusMessage: null,
        });
        break;
      }

      case "select_trump": {
        const m = msg as SelectTrumpMessage;
        set({
          phase: "trump_selection",
          availableSuits: m.suits,
          statusMessage: m.message,
        });
        break;
      }

      case "trump_set": {
        const m = msg as TrumpSetMessage;
        set({
          trumpSuit: m.suit,
          phase: "playing",
          statusMessage: m.message,
        });
        break;
      }

      case "your_turn": {
        const m = msg as YourTurnMessage;
        set({
          phase: "playing",
          hand: sortHand(m.hand),
          isMyTurn: true,
          currentTurnPlayer: get().selfName,
          statusMessage: m.message,
        });
        break;
      }

      case "card_played": {
        const m = msg as CardPlayedMessage;
        const isSelf = m.player === get().selfName;
        set((state) => ({
          phase: "playing",
          currentTrick: [...state.currentTrick, { player: m.player, card: m.card }],
          trickNumber: m.trick,
          hand: isSelf ? state.hand.filter((c) => c !== m.card) : state.hand,
          isMyTurn: false,
          currentTurnPlayer: null,
        }));
        break;
      }

      case "trick_won": {
        const m = msg as TrickWonMessage;
        set({
          lastTrickWinner: m.winner,
          scores: m.scores,
          trickNumber: m.trickNumber,
        });
        // Briefly show the completed trick, then clear it for the next round.
        setTimeout(() => {
          set({ currentTrick: [] });
        }, 1400);
        break;
      }

      case "game_ended": {
        const m = msg as GameEndedMessage;
        set({
          phase: "game_over",
          team1Score: m.data.team1,
          team2Score: m.data.team2,
          winnerTeam: m.data.winner === "Team 1" || m.data.winner === "team1" ? "team1" : "team2",
        });
        break;
      }

      case "error": {
        const m = msg as { type: "error"; message: string };
        set({ errorMessage: m.message });
        break;
      }

      default:
        // Unknown/future message types are ignored gracefully.
        break;
    }
  },
}));
