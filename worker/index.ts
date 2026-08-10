import { Router } from "itty-router";
import type { Env } from "./types";
import { createAuthToken, handleTelegramWebhook, validateInitData } from "./telegram";
import { getOrCreateUser, getLeaderboard } from "./db";
import { formatMessage } from "./persian-messages";
export { HokmGameRoom } from "./hokm-game-room";

const router = Router();

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

function isAllowedOrigin(origin: string, env: Env): boolean {
  if (!origin) return false;
  if (origin === env.FRONTEND_URL) return true;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;

  try {
    const frontendHost = new URL(env.FRONTEND_URL).hostname;
    const pagesDevMatch = frontendHost.match(/\.pages\.dev$/);
    if (pagesDevMatch) {
      const projectSuffix = frontendHost.replace(/^[^.]+\./, "");
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

// ✅ FIXED: /init endpoint - simplified to avoid hanging
router.post("/init", async (request: Request, env: Env) => {
  try {
    console.log("📥 /init endpoint called");
    
    // Check authorization
    const authHeader = request.headers.get('Authorization');
    const expectedAuth = `Bearer ${env.INIT_SECRET}`;
    
    console.log("🔍 Auth header present:", !!authHeader);
    
    if (authHeader !== expectedAuth) {
      console.log("❌ Authorization failed");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("✅ Authorization passed");
    
    let body: { externalUrl: string };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const externalUrl = body.externalUrl;
    
    if (!externalUrl) {
      return new Response(JSON.stringify({ error: "Missing externalUrl" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("📦 External URL:", externalUrl);

    // Set webhook with Telegram
    const token = env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = `${externalUrl}/telegram/webhook`;
    
    console.log("🔗 Setting webhook to:", webhookUrl);
    
    const response = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`
    );
    
    const result = await response.json();
    console.log("✅ Webhook response:", result);
    
    return new Response(JSON.stringify({
      status: "ok",
      message: "Webhook set successfully",
      telegramResponse: result
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("❌ Error setting webhook:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

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

  if (parsed.chat && String(parsed.chat.id) !== String(env.ALLOWED_GROUP_ID)) {
    return json({ status: 403, error: "این بازی فقط در گروه مجاز قابل استفاده است." }, { status: 403 }, cors);
  }

  const user = await getOrCreateUser(env, parsed.user);
  const displayName = [parsed.user.first_name, parsed.user.last_name].filter(Boolean).join(" ") || "بازیکن";

  const token = await createAuthToken(env, {
    uid: user.id,
    tid: parsed.user.id,
    name: displayName,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  });

  return json({ token }, { status: 200 }, cors);
});

router.options("*", (request: Request, env: Env) => new Response(null, { status: 204, headers: corsHeaders(request, env) }));

router.get("/ws", async (request: Request, env: Env) => {
  if (request.headers.get("Upgrade") !== "websocket") {
    return json({ status: 400, error: "Expected WebSocket upgrade" }, { status: 400 });
  }
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
    await handleTelegramWebhook(env, update as any);
  } catch (err) {
    console.error("Error handling Telegram webhook:", err);
  }

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