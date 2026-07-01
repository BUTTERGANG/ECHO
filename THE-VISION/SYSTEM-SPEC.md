# ECHO — System Spec

Full technical spec of what's actually built, as of this analysis. Written from
reading the code directly (`src/`, `server/`, config files) — not from any
external design doc, since none of those exist in this repo.

## What ECHO is

A local-first voice journaling app: record a voice note, get an on-device
Whisper transcript, optionally get an AI-generated three-part summary
(Anthropic Claude), track daily habits, and see mood/streak insights over
time. "Local-first" is the core architectural constraint: on web, all
structured data lives in the browser (SQLite via WASM + OPFS), all audio
blobs live in IndexedDB, and transcription runs client-side. Nothing about a
journal entry's content is required to leave the device unless the user
explicitly opts in to AI summaries.

## Tech stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Expo (SDK) | ~56.0.12 |
| Router | expo-router (file-based) | ~56.2.11 |
| UI runtime | React / react-dom | 19.2.3 |
| Native runtime | react-native | 0.85.3 |
| Web runtime | react-native-web | ~0.21.0 |
| ORM | drizzle-orm | ^0.45.2 |
| Local DB (web) | expo-sqlite → wa-sqlite (WASM, OPFS) | ~56.0.5 |
| State | zustand | ^5.0.14 |
| Backend server | express | ^5.2.1 |
| Language | TypeScript | ~6.0.3 |
| Node (deploy target) | nodejs-22 (Replit module), `engines.node >=20` | — |

React Compiler is enabled (`app.json` → `experiments.reactCompiler: true`),
which is why `eslint-plugin-react-hooks`'s purity/effect rules show up as
lint warnings (see "Known lint warnings" below) — the compiler is stricter
about hook rules than plain React.

## Architecture

```
                         ┌─────────────────────────────┐
                         │   Browser (web) / device     │
                         │                               │
  ┌──────────────┐       │  ┌─────────────────────────┐  │
  │ MediaRecorder │──────┼─▶│ audioStore (IndexedDB)   │  │
  └──────────────┘       │  └─────────────────────────┘  │
                         │              │                 │
                         │              ▼                 │
                         │  ┌─────────────────────────┐  │
                         │  │ whisper.ts               │  │
                         │  │ (transformers.js via CDN,│  │
                         │  │  runs on-device)          │  │
                         │  └─────────────────────────┘  │
                         │              │ transcript       │
                         │              ▼                 │
                         │  ┌─────────────────────────┐  │       ┌─────────────────┐
                         │  │ drizzle db (wa-sqlite/   │  │       │ server/index.mjs │
                         │  │ OPFS) — entries, habits, │  │──────▶│ (Express, thin,  │
                         │  │ ai_summaries, habit_logs │  │ HTTPS │  stateless)      │
                         │  └─────────────────────────┘  │  only  │  proxies only    │
                         │              ▲                 │  for   │  transcript text │
                         │              │ optional encrypt │  AI    │  to Anthropic    │
                         │  ┌─────────────────────────┐  │        └─────────────────┘
                         │  │ vault.ts (WebCrypto AES) │  │
                         │  └─────────────────────────┘  │
                         └─────────────────────────────┘
```

Audio and transcript text never transit the network except: the transcript
text alone, only when the user has opted into AI summaries, only for
non-private entries, sent to `server/index.mjs`'s proxy which forwards to
Anthropic and never persists it.

## Data model (`src/db/schema.ts`)

SQLite tables, Drizzle-defined, migrations in `src/db/migrations/`:

- **`entries`** — one row per journal entry. `transcript` may be an
  encrypted blob (see Encryption below) or plaintext. `audioPath` is an
  opaque key (`idb:<entryId>` on web) resolved by `audioStore`, not a real
  filesystem path. `deletedAt` is a soft-delete marker — deleted rows are
  excluded from reads but not physically removed until `deleteAllData()`.
- **`ai_summaries`** — one row per Claude summary, FK'd to `entries.id`,
  stores the parsed 3-part summary plus the raw response and prompt version
  (`ENTRY_SUMMARY_PROMPT_VERSION` in `src/constants/prompts.ts`) so prompt
  changes are traceable against old data.
- **`habits`** / **`habit_logs`** — user-defined daily habits and one
  check-in row per `(habit, date)`, unique-indexed.

Timestamps are epoch-millisecond integers; booleans are 0/1 integers
(SQLite has no native boolean type) — both are Drizzle/SQLite conventions,
not app-specific quirks.

## Frontend layer breakdown

- **Routing** (`src/app/`): expo-router file-based routes. `_layout.tsx` is
  the single root gate — it decides between a loading spinner, a DB-error
  screen, the passphrase unlock gate, or the real tab stack, based on
  migration state + vault status. Tabs: Home, Record, Habits, Insights,
  Settings (`src/app/(tabs)/`). Modals: compose, onboarding, encrypt-setup.
- **State** (`src/stores/`): four independent zustand stores — `entryStore`,
  `recordingStore`, `settingsStore` (persisted to `localStorage` on web via
  zustand's `persist` middleware, no-op elsewhere), `vaultStore` (in-memory
  only, deliberately never persisted — see Encryption).
- **Data access** (`src/db/queries/`): plain async functions per table
  (`entries.ts`, `habits.ts`, `summaries.ts`, `admin.ts`), all importing the
  singleton `db` from `src/db/client.ts`. No repository/service class layer
  — queries are just functions, called directly from hooks.
- **Hooks** (`src/hooks/`): thin wrappers pairing a `db/queries` function
  with React state (`useEntries`, `useHabits`), plus derived-data hooks
  (`useStreak`, `useResponsive`) and platform-conditional hooks
  (`use-color-scheme.web.ts` vs native, `useRecording.ts` vs
  `.native.ts`).
- **Services** (`src/services/`): the platform-straddling logic —
  `whisper.ts`/`.native.ts` (transcription), `claude.ts` (Claude proxy
  client), `vault.ts` (encryption key lifecycle), `audioStore.ts`/`.native.ts`
  (blob persistence), `export.ts`/`.native.ts` (data export).

Platform-split files use Metro's `.native.ts`/`.web.ts` (implicit) extension
convention throughout — e.g. `useRecording.ts` is the web
`MediaRecorder`-based implementation, `useRecording.native.ts` overrides it
for iOS/Android. This is a deliberate, consistent pattern across the whole
services/hooks layer, not an inconsistency to "fix."

## Encryption model (`src/services/vault.ts`, `src/utils/encryption.ts`)

Optional, off by default, web-only currently. A passphrase derives an
AES-GCM key (WebCrypto) that lives **only in module memory**
(`cryptoKey` in `vault.ts`) — never in a zustand store, never persisted.
What *is* persisted (plain `localStorage`, key `echo.vault.meta`): a salt and
a verifier blob, both safe in the clear. Losing the passphrase means the
data is unrecoverable by design. `entries.transcript` is the field encrypted
at the query layer (`decryptRow`/`encryptField` in `src/db/queries/entries.ts`
and `vault.ts`). `ai_summaries` text and audio blobs are **not yet
encrypted** — a known, documented gap (see DEPLOY.md, WEB_FIRST_NOTES.md).

## Backend (`server/index.mjs`)

Deliberately thin and stateless — see DEPLOY.md for the authoritative
version of this, kept here for the system-spec summary:

1. Serves the static `dist/` export (the built Expo web SPA).
2. Sets `Cross-Origin-Opener-Policy: same-origin` and
   `Cross-Origin-Embedder-Policy: <COEP_POLICY>` (default `credentialless`)
   on every response — required for wa-sqlite's `SharedArrayBuffer` usage.
   **This only takes effect for a real top-level navigation** — see
   `STARTUP-AND-BOOT.md` for why this breaks inside an iframe.
3. Proxies two Claude endpoints (`/api/anthropic/summary`,
   `/api/anthropic/weekly`) so `ANTHROPIC_API_KEY` never reaches the client
   bundle. Both are rate-limited in-memory (20 req/min/IP, resets on scale
   events — acceptable for a basic guard, not a hard quota).
4. `/healthz` for the Autoscale health check.

No database, no sessions, no server-side user state of any kind — the only
statefulness is the in-memory rate-limit map, which is fine to lose on
restart/scale.

## Known lint warnings (not bugs, not addressed here)

`npm run lint` currently reports 6 `react-hooks` warnings (0 errors):
`setState`-in-effect in `insights.tsx`, `MoodHeatmap.tsx`,
`use-color-scheme.web.ts`, `useEntries.ts`, `useHabits.ts`, and an impure
`Date.now()` call in `useStreak.ts`. These are React Compiler /
`eslint-plugin-react-hooks` purity-rule warnings, pre-existing, unrelated to
the boot-sequence work in `STARTUP-AND-BOOT.md`. Worth a cleanup pass, but
out of scope here — they don't affect correctness today.

## Platform-specific caveats

- `expo-sqlite`'s **web** support is alpha per Expo's own SDK 56 docs — the
  entire wa-sqlite/OPFS layer this app depends on for web storage is
  explicitly flagged upstream as "may be unstable." See
  `STARTUP-AND-BOOT.md` for the concrete failure mode this causes.
- `transformers.js` (Whisper) is loaded from a CDN at runtime, not bundled —
  its `onnxruntime-web` dependency uses dynamic `import()` patterns Metro
  can't statically bundle. This is intentional (see comment in
  `src/services/whisper.ts`), not a build gap.
- Native (iOS/Android) implementations of `whisper`, `audioStore`, and
  `useRecording` exist but are less exercised by this analysis, which
  focused on the web/Replit deployment path per the immediate ask.
