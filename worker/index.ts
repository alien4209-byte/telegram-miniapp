import { Router } from "itty-router";
import type { Env } from "./types";
import { createAuthToken, handleTelegramWebhook, validateInitData } from "./telegram";
import { getOrCreateUser, getLeaderboard } from "./db";
import { formatMessage } from "./persian-messages";
export { HokmGameRoom } from "./hokm-game-room";

const router = Router();

// ---------------------------------------------------------------------------
// CORS
//
// BUG FIXED: the previous deployment hardcoded a single Pages *preview* URL
// (`https://c2979f60.miniapp-scafolding.pages.dev`) as the only allowed origin.
// Every request from the real production domain (`miniapp-scafolding-2nv.pages.dev`,
// or any other preview deploy) was silently rejected by the browser's CORS check.
// This reflects the request's actual Origin back when it matches an allow-list:
//   - env.FRONTEND_URL exactly
//   - any `*.<project>.pages.dev` preview subdomain for the same Pages project
//   - localhost, for local dev
// ---------------------------------------------------------------------------

function isAllowedOrigin(origin: string, env: Env): boolean {
  if (!origin) return false;
  if (origin === env.FRONTEND_URL) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;

  // Match any preview deploy of the same Cloudflare Pages project, e.g.
  // https://<hash>.miniapp-scafolding.pages.dev, by extracting the project
  // name from FRONTEND_URL itself instead of hardcoding it.
  try {
    const frontendHost = new URL(env.FRONTEND_URL).hostname; // e.g. miniapp-scafolding-2nv.pages.dev
    const pagesDevMatch = frontendHost.match(/\.pages\.dev$/);
    if (pagesDevMatch) {
      const projectSuffix = frontendHost.replace(/^[^.]+\./, ""); // strips the leading subdomain
      const originHost = new URL(origin).hostname;
      if (originHost.endsWith(`.${projectSuffix}`) || originHost === projectSuffix) return true;
    }
  } catch {
    /* malformed FRONTEND_URL — fall through to reject */
  }

  return false;
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  if (isAllowedOrigin(origin, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(data: unknown, init: ResponseInit = {}, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders, ...(init.headers ?? {}) },
  });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/", () => json({ status: "ok", message: "این ربات تلگرام به درستی مستقر شده است." }));

router.post("/miniApp/init", async (request: Request, env: Env) => {
  const cors = corsHeaders(request, env);
  let body: { initData?: string };
  try {
    body = await request.json();
  } catch {
    return json({ status: 400, error: "Invalid JSON body" }, { status: 400 }, cors);
  }

  const initData = body.initData ?? "";
  const parsed = await validateInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!parsed || !parsed.user) {
    return json({ status: 400, error: "Invalid initDataRaw" }, { status: 400 }, cors);
  }

  // Group restriction: if the Mini App was launched with chat context attached
  // (e.g. from a group's attachment menu), enforce it matches the allowed group.
  if (parsed.chat && String(parsed.chat.id) !== String(env.ALLOWED_GROUP_ID)) {
    return json({ status: 403, error: "این بازی فقط در گروه مجاز قابل استفاده است." }, { status: 403 }, cors);
  }

  const user = await getOrCreateUser(env, parsed.user);
  const displayName = [parsed.user.first_name, parsed.user.last_name].filter(Boolean).join(" ") || "بازیکن";

  const token = await createAuthToken(env, {
    uid: user.id,
    tid: parsed.user.id,
    name: displayName,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12, // 12h
  });

  return json({ token }, { status: 200 }, cors);
});

router.options("*", (request: Request, env: Env) => new Response(null, { status: 204, headers: corsHeaders(request, env) }));

// WebSocket upgrade: forward to the (single, well-known) game room Durable Object.
// BUG FIXED: this route previously didn't exist at all, so every connection to
// `wss://.../ws` was hitting the Worker's default 404 handler instead of ever
// reaching the Durable Object.
router.get("/ws", async (request: Request, env: Env) => {
  if (request.headers.get("Upgrade") !== "websocket") {
    return json({ status: 400, error: "Expected WebSocket upgrade" }, { status: 400 });
  }
  // Single shared room for now — swap idFromName for a `room` query param if you
  // want multiple concurrent tables instead of one global room.
  const roomName = new URL(request.url).searchParams.get("room") || "default";
  const id = env.HOKM_GAME_ROOM.idFromName(roomName);
  const stub = env.HOKM_GAME_ROOM.get(id);
  return stub.fetch(request);
});

router.get("/leaderboard", async (request: Request, env: Env) => {
  const cors = corsHeaders(request, env);
  const entries = await getLeaderboard(env);
  return json({ leaderboard: entries }, { status: 200 }, cors);
});

router.post("/telegram/webhook", async (request: Request, env: Env) => {
  // Optional secret-token check (set via setWebhook's secret_token + TELEGRAM_WEBHOOK_SECRET).
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (provided !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleTelegramWebhook(env, update as any);
  } catch (err) {
    console.error("Error handling Telegram webhook:", err);
  }

  // Always 200 — Telegram retries aggressively on non-2xx responses.
  return new Response("OK", { status: 200 });
});

router.all("*", (request: Request, env: Env) => json({ status: 404, error: formatMessage("game_not_found") }, { status: 404 }, corsHeaders(request, env)));

// ---------------------------------------------------------------------------
// Worker entrypoint
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const response: Response = await router.handle(request, env, ctx);
      // Attach CORS headers to every HTTP (non-WebSocket) response uniformly.
      if (response.status !== 101) {
        const cors = corsHeaders(request, env);
        for (const [key, value] of Object.entries(cors)) {
          if (!response.headers.has(key)) response.headers.set(key, value);
        }
      }
      return response;
    } catch (err) {
      console.error("Unhandled error:", err);
      return json({ status: 500, error: formatMessage("unknown_error") }, { status: 500 }, corsHeaders(request, env));
    }
  },
};
