import type {
  CardCode,
  ClientMessage,
  Env,
  GamePhase,
  GameState,
  RoomPlayer,
  ServerMessage,
  Suit,
} from "./types";
import { HANDS_TO_WIN_MATCH, MAX_PLAYERS, MIN_PLAYERS_TO_START_WITH_BOTS, SUITS, TRICKS_PER_HAND, TRICKS_TO_WIN_HAND } from "./types";
import { formatMessage } from "./persian-messages";
import { verifyAuthToken } from "./telegram";
import { recordGameResult, updateUserScore } from "./db";
import { buildShuffledDeck, isHigher, parseSuit, toPersianDigits } from "./card-utils";
import { chooseCardToPlay, chooseTrumpSuit } from "./bot-ai";

interface SocketAttachment {
  playerId: string;
  name?: string;
}

function initialGameState(): GameState {
  return {
    phase: "waiting",
    deck: [],
    hands: [[], [], [], []],
    trumpSuit: null,
    currentTrick: [],
    currentPlayerIndex: 0,
    hakemIndex: 0,
    trickCount: 0,
    scores: { team1: 0, team2: 0 },
    players: [],
  };
}

export class HokmGameRoom {
  state: DurableObjectState;
  env: Env;
  players: RoomPlayer[] = [];
  gameState: GameState = initialGameState();
  connections: Map<string, WebSocket> = new Map();
  roomId: string;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.roomId = state.id.toString();

    // Restore persisted state and re-index any WebSockets that survived hibernation.
    this.state.blockConcurrencyWhile(async () => {
      const storedPlayers = await this.state.storage.get<RoomPlayer[]>("players");
      const storedGameState = await this.state.storage.get<GameState>("gameState");
      if (storedPlayers) this.players = storedPlayers;
      if (storedGameState) this.gameState = storedGameState;

      for (const ws of this.state.getWebSockets()) {
        const attachment = safeDeserialize(ws);
        if (attachment?.playerId) this.connections.set(attachment.playerId, ws);
      }
    });
  }

  // ---- HTTP entrypoint: only handles the WebSocket upgrade ----

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    // Identity: prefer the signed auth token (persists a player's identity across
    // reconnects); fall back to a fresh random id for anonymous/dev connections.
    let playerId: string;
    let presetName: string | undefined;
    const token = url.searchParams.get("token");
    if (token) {
      const payload = await verifyAuthToken(this.env, token);
      if (payload) {
        playerId = `tg:${payload.tid}`;
        presetName = payload.name;
      } else {
        playerId = crypto.randomUUID();
      }
    } else {
      playerId = crypto.randomUUID();
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation API: the DO can be evicted from memory between messages without
    // dropping the socket — `getWebSockets()` + `deserializeAttachment()` recover state.
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ playerId, name: presetName } satisfies SocketAttachment);
    this.connections.set(playerId, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- Hibernation API event handlers ----

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return; // ignore malformed frames
    }

    const attachment = safeDeserialize(ws);
    if (!attachment?.playerId) return;
    const playerId = attachment.playerId;

    try {
      switch (msg.type) {
        case "join": {
          const name = (msg.playerName || attachment.name || "").trim();
          if (!name) return;
          ws.serializeAttachment({ ...attachment, name } satisfies SocketAttachment);
          await this.handleJoin(playerId, name, ws);
          break;
        }
        case "set_trump":
          await this.setTrump(playerId, msg.suit);
          break;
        case "play_card":
          await this.playCard(playerId, msg.card);
          break;
        case "start_with_bots":
          await this.startWithBots(playerId);
          break;
        case "leave":
          await this.handleDisconnect(playerId);
          try {
            ws.close(1000, "left");
          } catch {
            /* already closed */
          }
          break;
      }
    } catch (err) {
      console.error("[webSocketMessage] handler threw:", err);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = safeDeserialize(ws);
    if (attachment?.playerId) await this.handleDisconnect(attachment.playerId);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("HokmGameRoom WebSocket error:", error);
    const attachment = safeDeserialize(ws);
    if (attachment?.playerId) await this.handleDisconnect(attachment.playerId);
  }

  // ---- Lobby ----

  private async handleJoin(playerId: string, name: string, ws: WebSocket): Promise<void> {
    this.connections.set(playerId, ws);

    // A finished match's room is reusable: the next "join" starts a brand new match.
    if (this.gameState.phase === "finished") {
      this.players = [];
      this.gameState = initialGameState();
    }

    const existingIdx = this.players.findIndex((p) => p.id === playerId);
    if (existingIdx === -1) {
      if (this.players.length >= MAX_PLAYERS) {
        this.sendTo(playerId, { type: "error", message: formatMessage("game_full") });
        return;
      }
      this.players.push({ id: playerId, name, seat: this.players.length, isBot: false });
    } else {
      this.players[existingIdx].name = name; // rejoin / rename
    }


    await this.persist();
    this.broadcastLobby();

    if (this.players.length === MAX_PLAYERS && this.gameState.phase === "waiting") {
      this.gameState.hakemIndex = 0;
      await this.beginHand();
    }
  }

  private broadcastLobby(): void {
    this.broadcast({
      type: "lobby_update",
      players: this.players.map((p) => ({ id: p.id, name: p.name })),
      count: this.players.length,
      maxPlayers: MAX_PLAYERS,
    });
  }

  /** Fills any empty seats with bots and starts the match immediately. */
  private async startWithBots(requesterId: string): Promise<void> {
    if (this.gameState.phase !== "waiting") return; // already started/finished — ignore

    const humanCount = this.players.filter((p) => !p.isBot).length;
    if (humanCount < MIN_PLAYERS_TO_START_WITH_BOTS) {
      this.sendTo(requesterId, { type: "error", message: formatMessage("need_min_players_for_bots") });
      return;
    }
    if (this.players.length >= MAX_PLAYERS) return; // already full, nothing to fill

    let botNumber = 1;
    while (this.players.length < MAX_PLAYERS) {
      this.players.push({
        id: `bot:${crypto.randomUUID()}`,
        name: `ربات ${toPersianDigits(botNumber)}`,
        seat: this.players.length,
        isBot: true,
      });
      botNumber++;
    }

    await this.persist();
    this.broadcastLobby();

    this.gameState.hakemIndex = 0;
    await this.beginHand();
  }

  private isBotSeat(seat: number): boolean {
    return !!this.players[seat]?.isBot;
  }

  private async handleDisconnect(playerId: string): Promise<void> {
    this.connections.delete(playerId);
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;

    if (this.gameState.phase === "waiting") {
      // Nobody's cards are dealt yet — just remove them and re-seat the rest.
      this.players.splice(idx, 1);
      this.players.forEach((p, i) => (p.seat = i));
      await this.persist();
      this.broadcastLobby();
      return;
    }

    // Mid-game disconnect: mark inactive and let everyone know. The seat/hand stay
    // intact so the same player (same auth token) can reconnect into the same spot.
    const gamePlayer = this.gameState.players[idx];
    if (gamePlayer) gamePlayer.isActive = false;
    await this.persist();
    this.broadcast({ type: "error", message: formatMessage("connection_error") });
  }

  // ---- Game flow ----

  private async beginHand(): Promise<void> {
    const deck = buildShuffledDeck();
    const hands: CardCode[][] = [[], [], [], []];
    for (let i = 0; i < deck.length; i++) {
      hands[i % MAX_PLAYERS].push(deck[i]);
    }

    this.gameState.hands = hands;
    this.gameState.deck = [];
    this.gameState.players = this.players.map((p) => ({ id: p.id, name: p.name, tricks: 0, isActive: true }));
    this.gameState.trumpSuit = null;
    this.gameState.currentTrick = [];
    this.gameState.trickCount = 0;
    this.gameState.currentPlayerIndex = this.gameState.hakemIndex;
    this.gameState.phase = "trump_selection" as GamePhase;

    await this.persist();

    const hakem = this.players[this.gameState.hakemIndex];
    this.broadcast({
      type: "game_started",
      data: { players: this.players.map((p) => ({ id: p.id, name: p.name })), hakem: hakem.name },
    });

    if (this.isBotSeat(this.gameState.hakemIndex)) {
      await this.botChooseTrump();
    } else {
      this.sendTo(hakem.id, { type: "select_trump", message: formatMessage("select_trump"), suits: SUITS });
    }
  }

  private async setTrump(playerId: string, suit: Suit): Promise<void> {
    if (this.gameState.phase !== "trump_selection") return;

    const seat = this.players.find((p) => p.id === playerId)?.seat;
    if (seat === undefined || seat !== this.gameState.hakemIndex) {
      this.sendTo(playerId, { type: "error", message: formatMessage("not_your_turn") });
      return;
    }
    if (!SUITS.includes(suit)) {
      this.sendTo(playerId, { type: "error", message: formatMessage("invalid_card") });
      return;
    }

    this.gameState.trumpSuit = suit;
    this.gameState.phase = "playing";
    this.gameState.currentPlayerIndex = this.gameState.hakemIndex;
    await this.persist();

    this.broadcast({ type: "trump_set", suit, message: formatMessage("trump_selected", { suit }) });
    await this.sendYourTurn(this.gameState.currentPlayerIndex);
  }

  private async playCard(playerId: string, card: CardCode): Promise<void> {
    if (this.gameState.phase !== "playing") return;

    const seat = this.players.find((p) => p.id === playerId)?.seat;
    if (seat === undefined) return;

    if (seat !== this.gameState.currentPlayerIndex) {
      this.sendTo(playerId, { type: "error", message: formatMessage("not_your_turn") });
      return;
    }

    const hand = this.gameState.hands[seat];
    if (!hand.includes(card)) {
      this.sendTo(playerId, { type: "error", message: formatMessage("invalid_card") });
      return;
    }

    if (this.gameState.currentTrick.length > 0) {
      const leadSuit = parseSuit(this.gameState.currentTrick[0].card);
      const cardSuit = parseSuit(card);
      const hasLeadSuit = hand.some((c) => parseSuit(c) === leadSuit);
      if (hasLeadSuit && cardSuit !== leadSuit) {
        this.sendTo(playerId, { type: "error", message: formatMessage("must_follow_suit") });
        return;
      }
    }

    this.gameState.hands[seat] = hand.filter((c) => c !== card);
    this.gameState.currentTrick.push({ playerId, card });
    await this.persist();

    this.broadcast({
      type: "card_played",
      player: this.players[seat].name,
      card,
      trick: this.gameState.trickCount + 1,
    });

    if (this.gameState.currentTrick.length === MAX_PLAYERS) {
      await this.resolveTrick();
    } else {
      this.gameState.currentPlayerIndex = (seat + 1) % MAX_PLAYERS;
      await this.persist();
      await this.sendYourTurn(this.gameState.currentPlayerIndex);
    }
  }

  private async resolveTrick(): Promise<void> {
    const trick = this.gameState.currentTrick;
    const leadSuit = parseSuit(trick[0].card);
    const trump = this.gameState.trumpSuit;

    let winning = trick[0];
    for (const played of trick.slice(1)) {
      if (isHigher(played.card, winning.card, leadSuit, trump)) winning = played;
    }

    const winnerSeat = this.players.find((p) => p.id === winning.playerId)!.seat;
    this.gameState.players[winnerSeat].tricks += 1;
    this.gameState.trickCount += 1;
    const trickNumber = this.gameState.trickCount;
    this.gameState.currentTrick = [];
    await this.persist();

    this.broadcast({
      type: "trick_won",
      winner: this.players[winnerSeat].name,
      trickNumber,
      scores: this.gameState.players.map((p) => ({ name: p.name, tricks: p.tricks })),
    });

    const team1Tricks = this.gameState.players[0].tricks + this.gameState.players[2].tricks;
    const team2Tricks = this.gameState.players[1].tricks + this.gameState.players[3].tricks;
    const handOver =
      this.gameState.trickCount >= TRICKS_PER_HAND ||
      team1Tricks >= TRICKS_TO_WIN_HAND ||
      team2Tricks >= TRICKS_TO_WIN_HAND;

    if (handOver) {
      await this.endHand(team1Tricks > team2Tricks ? "team1" : "team2");
    } else {
      this.gameState.currentPlayerIndex = winnerSeat;
      await this.persist();
      await this.sendYourTurn(winnerSeat);
    }
  }

  private async endHand(winnerTeam: "team1" | "team2"): Promise<void> {
    this.gameState.scores[winnerTeam] += 1;
    await this.persist();

    const matchOver =
      this.gameState.scores.team1 >= HANDS_TO_WIN_MATCH || this.gameState.scores.team2 >= HANDS_TO_WIN_MATCH;

    if (matchOver) {
      await this.finishMatch();
    } else {
      this.gameState.hakemIndex = (this.gameState.hakemIndex + 1) % MAX_PLAYERS;
      await this.beginHand();
    }
  }

  private async finishMatch(): Promise<void> {
    this.gameState.phase = "finished";
    const winnerTeam: "team1" | "team2" = this.gameState.scores.team1 > this.gameState.scores.team2 ? "team1" : "team2";
    const winnerLabel = formatMessage(winnerTeam === "team1" ? "team1" : "team2");
    await this.persist();

    this.broadcast({
      type: "game_ended",
      data: { team1: this.gameState.scores.team1, team2: this.gameState.scores.team2, winner: winnerLabel },
    });

    // Best-effort persistence — never let a D1 hiccup break the live game.
    try {
      const gameId = crypto.randomUUID();
      await recordGameResult(this.env, {
        gameId,
        roomId: this.roomId,
        players: this.players.map((p) => ({ id: p.id, name: p.name })),
        winner: winnerTeam,
        scoreTeam1: this.gameState.scores.team1,
        scoreTeam2: this.gameState.scores.team2,
      });

      for (const p of this.players) {
        if (!p.id.startsWith("tg:")) continue; // anonymous/dev players have no D1 row
        const telegramId = Number(p.id.slice(3));
        const team: "team1" | "team2" = p.seat % 2 === 0 ? "team1" : "team2";
        await updateUserScore(this.env, telegramId, team === winnerTeam);
      }
    } catch (err) {
      console.error("Failed to persist game result:", err);
    }
  }

  // ---- Messaging helpers ----

  private async sendYourTurn(seat: number): Promise<void> {
    const player = this.players[seat];
    if (!player) return;

    if (player.isBot) {
      await this.botPlayCard(seat);
      return;
    }

    this.sendTo(player.id, {
      type: "your_turn",
      hand: this.gameState.hands[seat],
      message: formatMessage("your_turn"),
    });
  }

  // ---- Bot AI: seat detection + delegating to pure functions in ./bot-ai ----

  private async botChooseTrump(): Promise<void> {
    const seat = this.gameState.hakemIndex;
    const bot = this.players[seat];
    const hand = this.gameState.hands[seat];
    const suit = chooseTrumpSuit(hand);
    await this.setTrump(bot.id, suit);
  }

  private async botPlayCard(seat: number): Promise<void> {
    const bot = this.players[seat];
    const hand = this.gameState.hands[seat];
    if (!bot || hand.length === 0) return;

    const chosen = chooseCardToPlay(hand, this.gameState.currentTrick, this.gameState.trumpSuit);

    // Reuses playCard's normal validation/broadcast/trick-resolution path — the
    // card chosen above is always legal by construction, so it will pass cleanly.
    await this.playCard(bot.id, chosen);
  }

  private sendTo(playerId: string, msg: ServerMessage): void {
    const ws = this.connections.get(playerId);
    if (!ws) return;
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket likely closed; will be cleaned up by webSocketClose */
    }
  }

  private broadcast(msg: ServerMessage): void {
    const json = JSON.stringify(msg);
    for (const ws of this.connections.values()) {
      try {
        ws.send(json);
      } catch {
        /* ignore individual send failures */
      }
    }
  }

  private async persist(): Promise<void> {
    await Promise.all([
      this.state.storage.put("players", this.players),
      this.state.storage.put("gameState", this.gameState),
    ]);
  }
}

function safeDeserialize(ws: WebSocket): SocketAttachment | undefined {
  try {
    return ws.deserializeAttachment() as SocketAttachment | undefined;
  } catch {
    return undefined;
  }
}
