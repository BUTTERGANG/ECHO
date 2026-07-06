# Deploying ECHO to Replit (Autoscale)

ECHO is **local-first**: the browser holds all data (sql.js WASM SQLite in a
Web Worker, persisted to IndexedDB). Two things go through a thin server proxy
so their API keys never reach the client bundle — **AI summaries** (Claude) and
**voice transcription** (Groq Whisper). The server (`server/index.mjs`) is
otherwise **stateless** — ideal for Autoscale (scale-to-zero, no shared
filesystem needed).

## What the server does
1. Serves the Expo web SPA from `dist/`.
2. Proxies Claude summaries (`/api/anthropic/summary`, `/api/anthropic/weekly`)
   so the Anthropic key stays server-side (never in the client bundle).
3. Proxies voice transcription (`/api/transcribe`): audio is uploaded, forwarded
   to Groq's hosted Whisper, and the transcript returned. **Audio is streamed
   through in-memory and never written to disk.** The Groq key stays server-side.
4. All proxies are rate-limited (20 req/min/IP).
5. `/healthz` for the autoscale health check.

It deliberately does **not** send cross-origin-isolation headers (COOP/COEP).
The web database is sql.js in a plain Web Worker — no `SharedArrayBuffer`,
no isolation requirement. That is what lets the app run inside Replit's
preview iframe, where isolation can never be enabled (the embedding page
controls it, and replit.com is not cross-origin isolated).

## One-time setup
1. Push this repo to Replit (or import it).
2. Add a **Deployment Secret** (Tools → Deployments → Secrets), NOT a regular
   env var, and NOT `EXPO_PUBLIC_*`:
   - `ANTHROPIC_API_KEY` = your Claude key (enables AI summaries)
   - `GROQ_API_KEY` = your Groq key (enables voice transcription) — get one at
     console.groq.com. Without it, recording still saves audio but transcription
     returns a "not configured" error.
   - *(optional)* `ALLOWED_ORIGIN` = `https://<your-deployment>.replit.app` — locks the proxies to your origin
   - *(optional)* `ANTHROPIC_MODEL`, `GROQ_TRANSCRIBE_MODEL` (default `whisper-large-v3-turbo`)
3. Deploy. `.replit` already declares:
   - target `autoscale`
   - build `npm ci && npm run build:web`
   - run `npm run serve`

## Verify after deploy
- `GET /healthz` → `{"ok":true,"ai":true,"stt":true}` (`ai`/`stt` reflect whether
  the Anthropic / Groq keys are set).
- Open the site, create a text entry → reload → it persists (proves the
  sql.js worker + IndexedDB persistence work).
- Enable AI summaries in Settings → **reload** → the toggle is still on (proves
  settings persistence) → open an entry → summary appears with the "To reflect
  on" follow-up question (proves the Claude proxy).
- **Record a voice note → transcript appears → audio plays back** (proves the
  capture loop: MediaRecorder → IndexedDB → `/api/transcribe` → Groq). On
  failure the record screen now shows the real error; also watch the console.

## Known risks / watch items
- **sql.js is loaded from the jsdelivr CDN at runtime**, not bundled (same
  technique as transformers.js — Metro can't bundle it; see
  `src/db/sqlWorker.ts`). First app boot needs network access to
  `cdn.jsdelivr.net`. A transient CDN failure surfaces as a database error
  screen with auto-retry (see `src/app/_layout.tsx`).
- **Persistence is snapshot-based.** The worker serializes the whole database
  to IndexedDB on a 250 ms debounce after every write. A tab killed within
  that window can lose the last write. Fine at journaling scale; revisit if
  write volume grows.
- **Transcription runs server-side (Groq), not on-device.** Earlier builds ran
  Whisper in the browser via transformers.js; that was replaced because the
  first-run model download (~240 MB) and WASM inference failed on constrained
  devices. Trade-off: **audio now leaves the device** to be transcribed (streamed
  through the proxy, not stored). It is still stored only on-device (IndexedDB).
  Cost is ~$0.04/hour of audio on `whisper-large-v3-turbo`.
- **Rate limiter is per-instance / in-memory.** Resets on scale events; it's a
  basic guard, not a global quota. Consider `ALLOWED_ORIGIN` + a real limiter if abused.
- **Encryption at rest (web) is opt-in and OFF by default.** When enabled (Settings →
  Security), transcripts are AES-256-GCM encrypted with a passphrase-derived key; when
  off, IndexedDB is origin-sandboxed but unencrypted, so anyone with device access can
  read entries. `ai_summaries` text + audio blobs are not yet encrypted (see WEB_FIRST_NOTES.md).
- **Node version.** Deploy pins `nodejs-22` (`.replit`); `package.json` requires Node ≥20.

## History: why not expo-sqlite (wa-sqlite) on web?
The web build originally used `expo-sqlite`'s wa-sqlite backend. It requires
`SharedArrayBuffer`, which requires cross-origin isolation — impossible inside
Replit's preview iframe, and fragile everywhere else (COOP/COEP headers, a
patched busy-wait timeout, a COI service worker). All of that was removed when
web moved to sql.js; native (iOS/Android) still uses real `expo-sqlite` via
`src/db/client.native.ts`, and both platforms apply the same drizzle-kit
migrations bundle.

## Static-host alternative (not chosen)
A pure static deployment is cheaper but can't host the key proxy — which is
exactly why we run the thin Autoscale server.
