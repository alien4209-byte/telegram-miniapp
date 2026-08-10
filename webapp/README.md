# بازی حکم — Hokm Telegram Mini App

A Persian (RTL) multiplayer Hokm card game frontend, built as a Telegram Mini App.
Talks to an existing Cloudflare Worker + Durable Objects backend over WebSocket.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS (felt-table / brass card-game theme, see `tailwind.config.js`)
- Zustand for game state (`src/hooks/useGameState.ts`)
- react-i18next for Persian/English translations
- Native `WebSocket` with auto-reconnect (`src/hooks/useWebSocket.ts`)

## Project structure

```
src/
├── components/       # Lobby, TrumpSelection, GameBoard, GameOver, Card, PlayerHand, TrickArea, ScoreBoard
├── hooks/            # useWebSocket, useGameState, useTelegram
├── contexts/         # GameContext — wires auth + websocket + actions together
├── i18n/             # i18next setup + fa/en translation.json
├── types/            # game.ts — shared domain types & WS message shapes
├── utils/            # cardHelpers.ts — sorting, follow-suit rules, Persian labels
├── App.tsx
└── main.tsx
```

## ⚠️ First things to check if the app doesn't load

1. **Confirm your actual worker URL.** Open your Worker's Cloudflare dashboard page and copy the
   exact `*.workers.dev` URL it's deployed to. This project ships with
   `wss://miniapp-scafolding.bdv94gs62z.workers.dev/ws` as the default — if your worker is
   actually at a different subdomain (e.g. `...leyli4209.workers.dev`), the socket will never
   connect. Update both lines in `.env` **and** the fallback constant at the top of
   `src/hooks/useWebSocket.ts` to match.

2. **Set the env vars in the Cloudflare Pages dashboard too**, not just in `.env`. A `.env` file
   is typically gitignored and never reaches the Pages build server unless you explicitly add
   `VITE_WS_URL` and `VITE_API_URL` under your Pages project → Settings → Environment variables.
   If they're missing there, the build falls back to whatever's hardcoded in `useWebSocket.ts`.

3. **You must open the app through Telegram, not a normal browser tab.** This is the most likely
   cause if you see a brass "must be opened inside Telegram" banner plus an endless
   "در حال تلاش مجدد برای اتصال..." spinner. Pasting the `*.pages.dev` URL into Chrome/Safari
   directly means `window.Telegram.WebApp.initData` is empty — there's no real Telegram session
   — so a backend that validates Telegram-signed `initData` (as this one does, for the group
   restriction feature) correctly rejects both the `/miniApp/init` call and, if it gates on the
   returned token, the WebSocket connection too. To test for real:
   - In [@BotFather](https://t.me/BotFather), run `/mybots` → your bot → **Bot Settings** →
     **Menu Button** (or **Configure Mini App**), and set the URL to your Pages URL
     (`https://miniapp-scafolding-2nv.pages.dev`).
   - Open a chat with your bot inside Telegram (mobile app, desktop app, or web.telegram.org) and
     tap that menu button — Telegram will inject real `initData` into the WebView.
   - Alternatively use a direct link: `https://t.me/<your_bot_username>/<app_short_name>`.

4. **Open the deployed site and check the browser console.** The WebSocket hook logs every step
   (`🔌 Connecting...`, `✅ connected`, `❌ disconnected`, `📩 received`, `📤 sent`). If you see
   `🔌 Connecting to WebSocket: wss://.../ws` but never `✅ WebSocket connected`, the URL or the
   worker itself is the issue. If you don't even see the `🔌` log, the bundle probably failed to
   build — check the Pages deployment build log for a failed step instead.

## Environment variables

Copy `.env.example` to `.env` (already provided pointing at the deployed worker):

```
VITE_WS_URL=wss://miniapp-scafolding.bdv94gs62z.workers.dev/ws
VITE_API_URL=https://miniapp-scafolding.bdv94gs62z.workers.dev
```

## Local development

```bash
npm install
npm run dev
```

Open the printed local URL in a normal browser to develop the UI — the app detects it's
not running inside Telegram and simply skips Telegram-specific calls (theme, initData).
To test the real auth flow, open the deployed Pages URL through your Telegram bot's menu button
or via `t.me/<bot>?startapp=...`.

## Build & deploy to Cloudflare Pages

```bash
npm run build
```

This outputs static assets to `dist/`. Deploy with either:

- **Cloudflare dashboard**: connect the repo, set build command `npm run build`,
  build output directory `dist`, and add the two env vars above as Pages environment variables.
- **Wrangler CLI**:
  ```bash
  npx wrangler pages deploy dist --project-name=hokm-miniapp
  ```

`public/_redirects` is included so client-side routing (if added later) falls back to `index.html`.

## Telegram Mini App integration notes

- `index.html` loads `https://telegram.org/js/telegram-web-app.js` directly — this is the
  most version-stable way to access `window.Telegram.WebApp` (`ready()`, `expand()`,
  `initData`, `colorScheme`, theme events) regardless of which `@telegram-apps/sdk-react`
  release is installed, so `src/hooks/useTelegram.ts` reads from it directly and degrades
  to no-ops outside Telegram.
- `@telegram-apps/sdk-react` is included in `package.json` per the required stack and is a
  good place to wire up richer native features later (BackButton, MainButton, HapticFeedback,
  CloudStorage) once you've pinned an exact SDK version — check that package's docs for the
  exact hook/import names for the version you install, since the v1 → v2 API changed shape.
- Auth flow: on load, `GameContext` POSTs `{ initData }` (from `window.Telegram.WebApp.initData`)
  to `${VITE_API_URL}/miniApp/init`, expects `{ token }` back, then opens
  `${VITE_WS_URL}?token=...`. Adjust `fetchAuthToken()` in `src/contexts/GameContext.tsx` if
  your backend's init contract differs.

## Game flow

1. **Lobby** — enter a name, join, see up to 4 seats fill in real time; auto-advances when full.
2. **Trump selection** — the Hakem picks ♠ ♥ ♦ ♣; everyone else sees a waiting state.
3. **Gameplay** — 13-card hand in a horizontal scroll (RTL), only legal (follow-suit) cards are
   tappable, current trick shown at table center, live team scores + trump indicator in the header.
4. **Game over** — winning team, final score, and a "بازی دوباره" button that resets local state
   (a fresh `join` message starts a new game against the same backend).

## Notes on network access during generation

This project was generated in a sandboxed environment without npm registry access, so
`npm install` / `tsc --noEmit` could not be run here to double-check compilation. The code
was written and manually reviewed for type-correctness, but please run:

```bash
npm install && npm run build
```

as your first step and fix any version-specific type mismatches (most likely candidates:
`@telegram-apps/sdk-react`'s exact export names, and minor `i18next`/`react-i18next` typing
differences between versions).
