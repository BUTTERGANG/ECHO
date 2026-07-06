---
name: expo-sqlite web COI + timeout setup
description: Historical — how ECHO used to handle SharedArrayBuffer / Sync operation timeout for expo-sqlite on web. Superseded by the sql.js migration; kept for context on why the current architecture looks the way it does.
---

## Superseded

The web database no longer uses `expo-sqlite` (wa-sqlite). It now runs
**sql.js (WASM SQLite) in a plain Web Worker**, persisted to IndexedDB —
see `src/db/sqlWorker.ts` and `src/db/client.ts`. This driver is async
message-passing end to end, so it needs no `SharedArrayBuffer`, no
cross-origin isolation, and no COI service worker. Everything below this
line describes the **old** setup and no longer reflects the code — kept
only so future work understands why the sql.js approach was chosen.

See `DEPLOY.md`'s "History" section and `THE-VISION/STARTUP-AND-BOOT.md`'s
"Bug #2" for the full story.

## The old rule (no longer applies)
The server used to send `Cross-Origin-Opener-Policy: same-origin` +
`Cross-Origin-Embedder-Policy: credentialless` on every response, plus a COI
service worker (`server/coi-serviceworker.js`), to make `SharedArrayBuffer`
available for wa-sqlite's synchronous worker communication. All of that —
the headers, the service worker, `patches/expo-sqlite+56.0.5.patch` — has
been deleted from the codebase.

**Why it was replaced:** `SharedArrayBuffer` requires the *top-level*
document to opt into cross-origin isolation, not just the framed page.
Replit's Webview preview panel embeds the app in an iframe whose parent
(the Replit IDE page) never sends those headers — so wa-sqlite could not
work inside the embedded preview at all, only via "Open in new tab." sql.js
has no such dependency, so it works in both contexts identically.

## Still current: workflow port
The Repl workflow runs on port 5000 (`PORT=5000`), matching `.replit`'s
`[[ports]]` mapping to `externalPort = 80`. The Run button now invokes
`npm run start:replit` (`scripts/ensure-dist.mjs` + `npm run serve`), not
`deploy:local` — see `THE-VISION/STARTUP-AND-BOOT.md`.

## Still current: screenshot tool limitation caveat
Historically the Replit screenshot tool could time out while the old
busy-wait DB init blocked the browser thread. That specific cause no longer
applies (sql.js init is async, non-blocking), but if a screenshot tool ever
hangs waiting for first paint again, verify server liveness independently
via `curl -s http://localhost:5000/healthz` (expect `{"ok":true,...}`)
before assuming the app itself is broken.
