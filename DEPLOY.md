# Deploying ECHO to Replit (Autoscale)

ECHO is **local-first**: the browser holds all data (wa-sqlite/OPFS) and runs
Whisper client-side. The server (`server/index.mjs`) is a thin, **stateless**
layer — ideal for Autoscale (scale-to-zero, no shared filesystem needed).

## What the server does
1. Serves the Expo web SPA from `dist/`.
2. Sends cross-origin-isolation headers (`COOP: same-origin`, `COEP: require-corp`)
   so wa-sqlite's `SharedArrayBuffer` works. **Production needs these** — the
   dev-only Metro middleware does not run here.
3. Proxies Claude summaries (`/api/anthropic/summary`) so the Anthropic key
   stays server-side (never in the client bundle). Rate-limited (20 req/min/IP).
4. `/healthz` for the autoscale health check.

## One-time setup
1. Push this repo to Replit (or import it).
2. Add a **Deployment Secret** (Tools → Deployments → Secrets), NOT a regular
   env var, and NOT `EXPO_PUBLIC_*`:
   - `ANTHROPIC_API_KEY` = your Claude key
   - *(optional)* `ALLOWED_ORIGIN` = `https://<your-deployment>.replit.app` — locks the proxy to your origin
   - *(optional)* `ANTHROPIC_MODEL`, `COEP_POLICY`
3. Deploy. `.replit` already declares:
   - target `autoscale`
   - build `npm ci && npm run build:web`
   - run `npm run serve`

## Verify after deploy
- `GET /healthz` → `{"ok":true,"ai":true}` (ai:true means the key is set).
- Open the site, create a text entry → reload → it persists (proves wa-sqlite +
  isolation headers work).
- Enable AI summaries in Settings → **reload** → the toggle is still on (proves
  settings persistence) → open an entry → summary appears (proves the proxy).
- **Record a voice note → transcript appears → audio plays back** (proves the
  capt­ure loop: MediaRecorder → IndexedDB → Whisper-from-CDN). This is the one
  that exercises the cross-origin model fetch — watch the browser console.

## Known risks / watch items
- **COEP vs the Whisper model download.** transformers.js (the library) loads from
  the jsdelivr CDN, which sends `Cross-Origin-Resource-Policy: cross-origin` — so it
  loads fine under `require-corp`. The **model weights** come from the HuggingFace
  CDN and are the one unavoidable cross-origin fetch; if transcription fails to load
  the model (check the browser console), set `COEP_POLICY=credentialless` (Chromium
  only) or self-host the model. **Test voice transcription on the deployed URL.**
  Note: `credentialless` is Chromium-only — if you set it, confirm wa-sqlite still
  works in Firefox/Safari (it relies on the same cross-origin isolation).
- **transformers.js is loaded at runtime, not bundled** (its onnxruntime dep can't
  be Metro-bundled — see WEB_FIRST_NOTES.md). The npm package was therefore removed
  from `dependencies`, so `npm ci` no longer installs `onnxruntime-node` + `sharp`
  (native binaries) — a faster, lower-risk build than before.
- **Rate limiter is per-instance / in-memory.** Resets on scale events; it's a
  basic guard, not a global quota. Consider `ALLOWED_ORIGIN` + a real limiter if abused.
- **Encryption at rest (web) is opt-in and OFF by default.** When enabled (Settings →
  Security), transcripts are AES-256-GCM encrypted with a passphrase-derived key; when
  off, OPFS is origin-sandboxed but unencrypted, so anyone with device access can read
  entries. `ai_summaries` text + audio blobs are not yet encrypted (see WEB_FIRST_NOTES.md).
- **Node version.** Deploy pins `nodejs-22` (`.replit`); `package.json` requires Node ≥20.

## Static-host alternative (not chosen)
A pure static deployment is cheaper but can't reliably set COOP/COEP or host the
key proxy — which is exactly why we run the thin Autoscale server.
