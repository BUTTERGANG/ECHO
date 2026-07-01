---
name: expo-sqlite web COI + timeout setup
description: How ECHO handles SharedArrayBuffer / Sync operation timeout for expo-sqlite on web in the Replit preview context.
---

## The rule
The server must send `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless` on every response. Without these, `new SharedArrayBuffer(4)` in `invokeWorkerSync` throws `ReferenceError: SharedArrayBuffer is not defined`.

**Why:** expo-sqlite's web backend (wa-sqlite) uses SharedArrayBuffer + Atomics for synchronous worker communication. SharedArrayBuffer is only available in cross-origin isolated contexts.

## Workflow must be on port 5000
Replit's webview output type requires port 5000. The workflow is configured with `PORT=5000 npm run serve`. The `.replit` PORT env var is 3000 and cannot be edited directly — override in the command.

## COI Service Worker
A COI service worker (`server/coi-serviceworker.js`) is served and injected into every HTML response by the Express server. It adds COOP/COEP headers at the browser level, bypassing the Replit preview iframe parent restriction. A sessionStorage guard prevents infinite reload loops.

**How to apply:** The injection is in `server/index.mjs` — the `COI_SNIPPET` constant is injected before `</head>` on every HTML response. The SW is served at `/coi-serviceworker.js`.

## Sync operation timeout
Even with SharedArrayBuffer available, `openDatabaseSync` can throw "Sync operation timeout" on cold start because WASM init + OPFS setup takes longer than the busy-wait iteration cap.

**Fix:**
1. `patches/expo-sqlite+56.0.5.patch` raises iteration cap 100x (`1e8`/`1e11`). Verify it's applied: dist worker should contain `1e8` near "Sync operation timeout".
2. `OPEN_DB_ATTEMPTS = 5` in `src/db/client.ts` — gives worker ~5-10s total.
3. `resetDb()` exported from `client.ts` clears cached error/instance.
4. `src/app/_layout.tsx` auto-retries up to 3 times with 2.5s delays before surfacing error + manual Retry button.

**Why:** The wa-sqlite worker keeps warming up even after the main-thread busy-wait times out. A short pause + retry usually succeeds on the next attempt.

## Screenshot tool limitation
The Replit screenshot tool times out during DB init because the busy-wait blocks the browser. This is expected — don't use screenshots to verify DB init success. Verify via: `curl -s http://localhost:5000/healthz` (should be `{"ok":true}`).
