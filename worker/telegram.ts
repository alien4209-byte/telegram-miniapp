import type { Env } from "./types";

// ---------------------------------------------------------------------------
// Telegram WebApp initData validation
// Algorithm per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//   secret_key = HMAC_SHA256("WebAppData", bot_token)          [note: "WebAppData" is the key, bot_token is the message]
//   data_check_string = all fields except "hash", sorted by key, joined as "key=value" with "\n"
//   valid if HMAC_SHA256(secret_key, data_check_string) === hash
// ---------------------------------------------------------------------------

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ParsedInitData {
  user: TelegramUser | null;
  chat?: { id: number; type: string };
  authDate: number;
}

/**
 * Validates a Telegram Mini App `initData` string against the bot token.
 * Returns the parsed data on success, or null if the signature is invalid/missing.
 */
export async function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): Promise<ParsedInitData | null> {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
  const computedHash = bufToHex(await hmacSha256(secretKey, dataCheckString));

  if (computedHash !== hash) return null;

  const authDate = Number(params.get("auth_date") ?? 0);
  if (maxAgeSeconds > 0 && Date.now() / 1000 - authDate > maxAgeSeconds) {
    return null; // stale initData, likely replayed
  }

  let user: TelegramUser | null = null;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as TelegramUser;
    } catch {
      user = null;
    }
  }

  let chat: { id: number; type: string } | undefined;
  const chatRaw = params.get("chat");
  if (chatRaw) {
    try {
      chat = JSON.parse(chatRaw) as { id: number; type: string };
    } catch {
      chat = undefined;
    }
  }

  return { user, chat, authDate };
}

// ---------------------------------------------------------------------------
// Lightweight signed auth tokens (HMAC, not a full JWT library) for the mini app.
// Payload: { uid, tid, name, exp }  -> base64url(payload) + "." + base64url(hmac)
// ---------------------------------------------------------------------------

export interface AuthTokenPayload {
  uid: number; // internal D1 users.id
  tid: number; // telegram_id
  name: string;
  exp: number; // unix seconds
}

function base64url(bytes: Uint8Array): string {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  const bin = atob(padded);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}

function tokenSecret(env: Env): string {
  return env.AUTH_TOKEN_SECRET || env.TELEGRAM_BOT_TOKEN;
}

export async function createAuthToken(env: Env, payload: AuthTokenPayload): Promise<string> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadPart = base64url(payloadBytes);
  const sig = await hmacSha256(new TextEncoder().encode(tokenSecret(env)), payloadPart);
  const sigPart = base64url(new Uint8Array(sig));
  return `${payloadPart}.${sigPart}`;
}

export async function verifyAuthToken(env: Env, token: string): Promise<AuthTokenPayload | null> {
  const [payloadPart, sigPart] = token.split(".");
  if (!payloadPart || !sigPart) return null;

  const expectedSig = await hmacSha256(new TextEncoder().encode(tokenSecret(env)), payloadPart);
  const expectedSigPart = base64url(new Uint8Array(expectedSig));
  if (expectedSigPart !== sigPart) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadPart))) as AuthTokenPayload;
    if (payload.exp && payload.exp < Date.now() / 1000) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Telegram Bot API
// ---------------------------------------------------------------------------

const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegramMessage(
  env: Env,
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await fetch(`${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
}

/** Sends the "open the game" prompt with an inline Web App button. */
export async function sendOpenGamePrompt(env: Env, chatId: number | string, promptText: string): Promise<void> {
  // Cache-bust so Telegram's WebView always fetches the latest deployed
  // frontend instead of serving a stale cached bundle from a previous session.
  const miniAppUrl = `${env.FRONTEND_URL}?v=${Date.now()}`;
  await sendTelegramMessage(env, chatId, promptText, {
    reply_markup: {
      inline_keyboard: [[{ text: "🎴 باز کردن بازی حکم", web_app: { url: miniAppUrl } }]],
    },
  });
}

interface TelegramUpdate {
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: TelegramUser;
    text?: string;
  };
}

/**
 * Handles a Telegram webhook update. Group restriction has been removed per
 * current requirements — the bot now responds in any chat (group or private).
 */
export async function handleTelegramWebhook(env: Env, update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;

  const text = message.text?.trim() ?? "";
  if (text === "/start" || text === "/hokm" || text === "/play") {
    await sendOpenGamePrompt(env, message.chat.id, "به بازی حکم خوش آمدید! 🎴");
  }
}
