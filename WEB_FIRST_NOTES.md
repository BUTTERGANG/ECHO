# ECHO — Web-First Build Notes

The handoff doc (`Implementation Plan v1.0`) targets **React Native + Expo native**.
This codebase is being built **web-first** (web now → iOS/Android later) using one
**Expo universal** codebase. Per the doc's governance rule ("if something in code
contradicts this document, flag it"), here are the intentional deviations.

| # | Doc says | This build does | Why |
|---|---|---|---|
| 1 | RN + Expo (native) | Expo **universal** (react-native-web); routes under `src/app/` | Web first, no dev account yet; one codebase migrates to mobile |
| 2 | Whisper via `whisper-rn` (native only) | **Server-side Groq Whisper** on web: `src/services/whisper.ts` uploads audio to the `/api/transcribe` proxy (`server/index.mjs`); `whisper.native.ts` is a stub for the native phase | whisper-rn can't run on web; on-device transformers.js proved unreliable (large model download + WASM OOM), so transcription moved server-side. **Trade-off: audio now leaves the device for transcription** — see §2.1 note below |
| 3 | `expo-av` | **`expo-audio`** | expo-av is deprecated as of SDK 56 |
| 4 | SQLCipher encryption at rest (§4.3) | **App-level field encryption** instead — opt-in AES-256-GCM (WebCrypto), key derived from a passphrase (PBKDF2). See "Encryption at rest" below | No SQLCipher in-browser; this is the web equivalent |
| 5 | `bun` | **npm** | bun not installed locally |
| 6 | Audio `.m4a` | web `MediaRecorder` → webm/opus; native m4a | platform-native recording formats |
| 7 | API key via `.env` + expo-constants | **Server proxy** (`server/index.mjs`); key is a server secret, never in the bundle. `EXPO_PUBLIC_…` is native-dev only and blocked from web builds by `scripts/check-web-env.mjs` | fixes Open Q #3 for hosted web |
| 8 | Template `NativeTabs` | standard Expo Router `Tabs` + vector icons | consistent web+native, no per-tab PNG assets |

## Web runtime requirements
- The web database is **sql.js (WASM SQLite) in a plain Web Worker**
  (`src/db/sqlWorker.ts`, drizzle `sqlite-proxy` driver in `src/db/client.ts`),
  persisted to IndexedDB. It needs **no COOP/COEP headers and no cross-origin
  isolation** — which is what lets the app run inside Replit's preview iframe.
  Native uses real `expo-sqlite` (`client.native.ts`); both apply the same
  drizzle-kit migrations bundle. (The earlier wa-sqlite/SharedArrayBuffer setup
  and its header/patch machinery were removed — see DEPLOY.md "History".)
- sql.js is loaded from a CDN at runtime inside the worker (indirect `import()`
  hidden from Metro).
- **Transcription is server-side.** `whisper.ts` uploads the recorded audio blob
  to the same-origin `/api/transcribe` proxy, which forwards it to Groq's hosted
  Whisper (`whisper-large-v3-turbo`) with the key server-side and returns
  `{ text }`. The earlier on-device transformers.js backend (Whisper via WASM,
  model fetched from a CDN) was removed: the first-run model download was large
  and WASM inference OOM'd on constrained devices.
- **§2.1 privacy note:** audio is *stored* only on-device (IndexedDB) but is now
  *transmitted* to the server for transcription (streamed through, never stored
  server-side). The record screen + Settings copy reflect this ("transcribed
  securely… never stored"), a deliberate change from the original on-device
  guarantee.

## Voice capture loop (web) — record → transcribe → summarize
- `hooks/useRecording.ts` (web): `MediaRecorder` lifecycle — mic permission, start/stop,
  live duration. Returns the recorded `Blob`. `useRecording.native.ts` is the native stub.
- `services/audioStore.ts` (web): persists the audio `Blob` in **IndexedDB** keyed by entry
  id (`audioPath = idb:<id>`); audio stays on-device. `audioStore.native.ts` stub will use
  the filesystem.
- `app/(tabs)/record.tsx` orchestrates: stop → persist audio → `createEntry` (audio saved
  **before** transcription so a transcription failure can't lose the recording) →
  `transcribe` (uploads to `/api/transcribe`) → `updateEntry(transcript)` →
  `maybeSummarizeEntry` → `push` to the entry (not `replace`, so the header back
  button works). A transcription failure surfaces the real error to the user.
- Playback: `components/AudioPlayer.web.tsx` (HTMLAudioElement off-DOM) in the entry detail;
  `AudioPlayer.tsx` is the native stub (renders nothing).
- **Still needs a browser click-through** (mic capture can't run in plain Node, and
  `/api/transcribe` needs `GROQ_API_KEY` on the server): record → transcript appears →
  audio plays back, ideally on the deployed URL.

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

## Analytical workbench (desktop) + operational telemetry direction
The product is evolving beyond a diary into an **operational/cognitive telemetry**
tool (heuristic, explicitly **non-clinical** — statuses like Nominal / Degraded /
Overextended, never psychological labels). Layout is **mobile-first with an
`isDesktop` 3-pane enhancement**:
- **Mobile/tablet:** the clean single-column capture stream (`EntriesStream`,
  extracted from the old `index.tsx`). The State Board is reached from the Home
  header (pulse icon → `/state` sub-view).
- **Desktop (`isDesktop`):** Home unfolds into `Workbench` — three fixed panes,
  **State (left) | stream (center) | Telemetry (right)**, 1px hairline dividers,
  no shadows, monospace metrics (`Fonts.mono`). Deliberately stark: **no
  time-of-day tint** on the workbench (that warmth stays on mobile capture).
- **State Board** (`components/workbench/StateBoard.tsx`): DOB capture →
  `profileStore` (persisted like settings); live precise-age ticker,
  days-since-last-pivot, and `MoodHeatmap` as the historical baseline. Age/day
  math in `utils/dateHelpers.ts` (`preciseAgeYears`, `daysSince`).
- **Telemetry Deck** (`TelemetryDeck.tsx`): **placeholder** — real shell/aesthetic,
  but resting "Nominal" and explicit that live scoring is not online. The risk
  engine (per-entry scoring + cross-entry 7/30-day aggregation + intervention
  cards) is the next step; tokens live in `constants/theme.ts` (`TelemetryStatuses`,
  `TelemetryColors`).

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

## Dayora-parity features (added post-scaffold)
- **Server-side transcription** (Groq) — see the deviation table row 2 above and DEPLOY.md.
- **Energy tracking** — `EnergyPicker` (low/med/high → `entries.energy_level`, already in
  the schema) captured in `compose.tsx`, shown on the entry detail beside mood.
- **Time-aware theming** — `useTimeOfDay` + a subtle tint wash in `Screen.tsx` that shifts
  morning → afternoon → evening → night (`TimeOfDayTints` in `constants/theme.ts`).
- **AI follow-up question** — entry-summary prompt bumped to **v1.1** (adds a `follow_up`
  field; client `constants/prompts.ts` and the server copy in `server/index.mjs` must stay
  in sync). New `ai_summaries.follow_up` column (migration `0002`); shown as "To reflect
  on" in `SummaryBlock`.
