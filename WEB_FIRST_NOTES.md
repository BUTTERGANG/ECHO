# ECHO — Web-First Build Notes

The handoff doc (`Implementation Plan v1.0`) targets **React Native + Expo native**.
This codebase is being built **web-first** (web now → iOS/Android later) using one
**Expo universal** codebase. Per the doc's governance rule ("if something in code
contradicts this document, flag it"), here are the intentional deviations.

| # | Doc says | This build does | Why |
|---|---|---|---|
| 1 | RN + Expo (native) | Expo **universal** (react-native-web); routes under `src/app/` | Web first, no dev account yet; one codebase migrates to mobile |
| 2 | Whisper via `whisper-rn` (native only) | **transformers.js** Whisper on web (`src/services/whisper.ts`), **loaded from a CDN at runtime** (not bundled — see below); `whisper.native.ts` is a stub for the native phase | whisper-rn can't run on web; transformers.js keeps audio on-device (preserves §2.1) |
| 3 | `expo-av` | **`expo-audio`** | expo-av is deprecated as of SDK 56 |
| 4 | SQLCipher encryption at rest (§4.3) | **App-level field encryption** instead — opt-in AES-256-GCM (WebCrypto), key derived from a passphrase (PBKDF2). See "Encryption at rest" below | No SQLCipher in-browser; this is the web equivalent |
| 5 | `bun` | **npm** | bun not installed locally |
| 6 | Audio `.m4a` | web `MediaRecorder` → webm/opus; native m4a | platform-native recording formats |
| 7 | API key via `.env` + expo-constants | **Server proxy** (`server/index.mjs`); key is a server secret, never in the bundle. `EXPO_PUBLIC_…` is native-dev only and blocked from web builds by `scripts/check-web-env.mjs` | fixes Open Q #3 for hosted web |
| 8 | Template `NativeTabs` | standard Expo Router `Tabs` + vector icons | consistent web+native, no per-tab PNG assets |

## Web runtime requirements
- `expo-sqlite` on web needs Metro wasm + COOP/COEP headers → handled in `metro.config.js`
  for dev. **Production hosting must send the same `Cross-Origin-Opener-Policy: same-origin`
  + `Cross-Origin-Embedder-Policy: require-corp` headers.**
- transformers.js downloads the Whisper model on first use (cached in browser). WebGPU is
  used when available, with a WASM fallback.
- **transformers.js is loaded from a CDN at runtime, not bundled.** Its `onnxruntime-web`
  dependency ships prebuilt `.mjs` files whose dynamic `import()` Metro can't parse, so
  `expo export` fails the moment anything imports `whisper.ts`. `whisper.ts` therefore
  pulls the library from `cdn.jsdelivr.net/.../@huggingface/transformers/+esm` via an
  indirect `import()` hidden from Metro. The library + model weights are cross-origin, so
  under `COEP: require-corp` they can be blocked — set `COEP_POLICY=credentialless`
  (server/index.mjs) or self-host. This needs the same browser click-through as the model
  download to confirm.

## Voice capture loop (web) — record → transcribe → summarize
- `hooks/useRecording.ts` (web): `MediaRecorder` lifecycle — mic permission, start/stop,
  live duration. Returns the recorded `Blob`. `useRecording.native.ts` is the native stub.
- `services/audioStore.ts` (web): persists the audio `Blob` in **IndexedDB** keyed by entry
  id (`audioPath = idb:<id>`); audio stays on-device. `audioStore.native.ts` stub will use
  the filesystem.
- `app/(tabs)/record.tsx` orchestrates: stop → persist audio → `createEntry` (audio saved
  **before** transcription so a Whisper failure can't lose the recording) → `transcribe` →
  `updateEntry(transcript)` → `maybeSummarizeEntry` → open the entry.
- Playback: `components/AudioPlayer.web.tsx` (HTMLAudioElement off-DOM) in the entry detail;
  `AudioPlayer.tsx` is the native stub (renders nothing).
- **Still needs a browser click-through** (mic + model download can't run in plain Node):
  record → transcript appears → audio plays back, ideally on the deployed (COEP) URL.

## Encryption at rest (opt-in, web)
- Default OFF (keeps the zero-friction path). Settings → Security → "Encrypt journal"
  sets a passphrase; an unlock gate (`UnlockGate`) appears on launch when enabled.
- AES-256-GCM via WebCrypto; key derived with PBKDF2-SHA-256 (210k iters). Only the
  salt + a verifier blob are persisted (localStorage); the key lives in memory only.
  **No recovery** — forgotten passphrase = unreadable entries (by design).
- Primitives: `src/utils/encryption.ts` (web) / `encryption.native.ts` (stub).
  Key mgmt: `src/services/vault.ts`. Transparent en/decrypt in `db/queries/entries.ts`
  (marker-prefixed `enc:v1:` values; migrates existing rows on enable/disable).
- **Current scope:** entry *transcripts* only. `ai_summaries` text and audio blobs are
  NOT yet encrypted — follow-up. Native should use SQLCipher (whole-DB) instead.

## Build config required by Drizzle's expo migrator (don't remove)
- `metro.config.js`: `sql` added to `resolver.sourceExts` (migrations import `.sql`).
- `babel.config.js`: `babel-plugin-inline-import` for `.sql` — inlines migration SQL as a
  string at build time. Without it the bundler tries to parse SQL as JS and fails.
- Validated with `npx expo export --platform web` (all 13 routes bundle).

## Status: Phase 1 scaffold complete
Done: project init, web config, deps, `src/` structure, Drizzle schema (entries,
ai_summaries, habits, habit_logs) + first migration, DB client, query layer, Claude
client, platform-split Whisper, stores, hooks, three tab screens + entry detail.
Typecheck clean; `expo-doctor` 21/21.

Done (web): the full voice capture loop — live recording (`useRecording`), audio
persistence (`audioStore.ts`, IndexedDB), on-device transcription (`whisper.ts` via CDN),
and audio playback (`AudioPlayer.web.tsx`). See "Voice capture loop" above. tsc + lint
clean; `expo export --platform web` bundles. Browser click-through still pending.

Stubbed for their respective phases: data export (`export.ts`, Step 10), native Whisper
(`whisper.native.ts`), native recording/persistence/playback (`*.native.ts`).
