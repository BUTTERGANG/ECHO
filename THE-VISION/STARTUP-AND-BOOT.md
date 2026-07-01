# ECHO — Startup, Build & Boot Process

This documents the exact chain from "click Run in Replit" to "app on
screen," and the specific white-screen failures found and fixed while
tracing it. Read `SYSTEM-SPEC.md` first for the architecture; this file is
about *sequence and failure modes*, not structure.

## The script chain

`package.json` scripts, in the order they actually get called:

```
build:web  = node scripts/check-web-env.mjs && expo export --platform web
serve      = node server/index.mjs
deploy:local = npm run build:web && npm run serve
```

`check-web-env.mjs` is a pre-build guard, not part of the app's runtime — it
fails the build if `EXPO_PUBLIC_ANTHROPIC_API_KEY` is set anywhere reachable
(env or `.env*`), because `EXPO_PUBLIC_*` values get inlined into the client
bundle at export time and that key must only ever live server-side. It's a
guard against a real secret-leak class of bug, not boot-sequence code.

`.replit` has **two separate places** this chain gets invoked, and they are
not the same thing:

```toml
run = "npm run deploy:local"          # dev: the Repl's "Run" button

[deployment]
build = ["sh", "-c", "npm ci && npm run build:web"]
run   = ["sh", "-c", "npm run serve"]  # a published Autoscale Deployment
```

Both ultimately run the same two scripts, but they are two **separate
build artifacts** — a `Deployment` in Replit's sense is a distinct publish
step, not "the dev server, but permanent." If you fix something in the repo
and only restart the dev Repl, an existing published Deployment does not
pick up the change until it's redeployed, and vice versa. Worth keeping
straight when debugging "I fixed it but it's still broken" — check *which*
of the two you're actually looking at.

The `[[ports]]` section maps `localPort = 3000` (where `server/index.mjs`
binds, via `PORT` env) to `externalPort = 80`. Replit's port-forwarding list
is managed by Replit's own tooling based on what it detects listening, not
purely a static file you hand-edit — don't be surprised if entries appear or
disappear here that don't trace to a deliberate change in this repo.

## Boot sequence, end to end

1. **Server process starts** (`node server/index.mjs`): binds `PORT`
   (default 3000), sets COOP/COEP headers on every response, serves
   `dist/index.html` for `/` and any non-API GET/HEAD (SPA fallback).
2. **Browser requests `/`**: gets `index.html`, which `<script defer>`-loads
   the single hashed JS bundle (`_expo/static/js/web/entry-<hash>.js`).
3. **Bundle evaluates, top to bottom, before React exists.** This is the
   critical detail for everything below: any module-level code that throws
   here has **no React tree yet to catch it** — the page stays exactly as
   `index.html` left it (an empty `<div id="root">`), which renders as a
   blank white page with zero visual indication anything went wrong. The
   only trace is a browser-console exception.
4. **React mounts, `_layout.tsx` runs**: calls `useRunMigrations()` (runs
   the Drizzle migrator against the DB) and `hydrateVault()` (reads
   encryption state from `localStorage`), then gates rendering on
   `success && vaultHydrated` before showing the real tab stack.

Step 3 is where both real bugs below lived, and step 4 is where the fixes
now surface them instead.

## Bug #1 (fixed): `openDatabaseSync` throwing at module load

`src/db/client.ts` used to call `openDatabaseSync()` directly at module
top-level:

```ts
export const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });
```

On web, `expo-sqlite` fakes "sync" with a busy-wait (`Atomics.pause`/`wait`
in a loop, capped at an iteration count) on the main thread while a Web
Worker does real async work: WASM instantiation + OPFS pool setup
(`AccessHandlePoolVFS`). On a CPU-constrained boot — verified by driving the
built app with headless Chromium against this exact container (2 vCPUs) —
the worker sometimes doesn't finish before the cap trips, and
`openDatabaseSync` throws `Error: Sync operation timeout`. Because this
happened during module evaluation (step 3 above), the throw was uncaught:
blank white page, one exception in the console, nothing on screen to say
why.

A prior patch (`patches/expo-sqlite+56.0.5.patch`) already raised that
iteration cap 100x. That helps but doesn't remove the race — it's a
CPU-cycle proxy for a wall-clock budget, not an actual guarantee, and
Expo's own SDK 56 docs flag `expo-sqlite` web support as alpha /"may be
unstable" for exactly this kind of reason.

**Fix applied** (`src/db/client.ts`): the `openDatabaseSync()` call is now
deferred behind a lazy `Proxy`, so it only actually runs on first property
access (`db.select(...)`, etc.) — which happens inside `useRunMigrations()`'s
effect, i.e. *after* React has mounted. `useMigrations` (drizzle-orm) already
catches that into an `error` state, which `_layout.tsx` already rendered as
a "Database error" screen — that path just wasn't reachable before, because
the throw happened too early to hit it. No other file needed to change:
existing call sites (`db.select`, `db.insert`, …) work unmodified because
the Proxy binds methods to the real instance.

This does **not** fix the underlying CPU race — a genuinely slow/loaded
container can still lose it. It converts "silent blank screen" into "visible
error message," which was the actual ask. The real fix for the race itself
would be migrating the web path off the sync driver entirely
(`openDatabaseAsync` + an async query path) — a larger structural change,
deliberately not done here; see DEPLOY.md's existing note on this.

## Bug #2 (platform limitation, not fixable in code): Replit's Webview iframe blocks `SharedArrayBuffer`

Reproduced directly: built a bare parent HTML page that iframes the app
without setting COOP/COEP on the *parent* document (exactly how Replit's own
Webview panel embeds a Repl's preview — the Replit IDE page itself doesn't
send these headers), and loaded it in headless Chromium. Inside that
iframe:

```
crossOriginIsolated: false
hasSharedArrayBuffer: false
bodyText: "Database error \n SharedArrayBuffer is not defined"
```

Cross-origin isolation cannot be granted by a framed document alone — the
top-level document has to also opt in (COOP/COEP or an explicit
Permissions-Policy allowance). Replit's Webview panel doesn't, so
`SharedArrayBuffer` is unavailable to anything running inside it, regardless
of the correct headers `server/index.mjs` sends. wa-sqlite's entire storage
layer depends on `SharedArrayBuffer` — **the app cannot use local storage at
all inside the embedded Webview panel**, full stop, independent of anything
in this codebase.

With Bug #1's fix in place, this now also surfaces as a visible "Database
error / SharedArrayBuffer is not defined" message rather than a blank
screen — but the message is small, centered, mostly-white-background text,
easy to mistake for "nothing rendered" at a glance in a small preview pane.

**What to actually do:** open the app via Replit's "Open in new tab" button
(the external-link icon on the Webview panel toolbar) — a real top-level
browser tab gets the server's own COOP/COEP headers applied directly, and
`SharedArrayBuffer` works normally. The embedded panel will never work for
this app's storage architecture; that's not something a code change can
paper over.

## Defense in depth added: `ErrorBoundary`

Both bugs above happened to be reachable through `_layout.tsx`'s existing
DB-error branch once deferred past module-eval time — but that branch only
catches *DB-init* failures specifically. Any other future error thrown
during rendering (a screen bug, a bad hook, anything not related to the DB)
had no equivalent safety net and would still blank-screen the whole app.

Added `src/components/ErrorBoundary.tsx` (a standard React class-component
error boundary — hooks cannot implement this) wrapping all of
`_layout.tsx`'s content. It catches render/lifecycle errors anywhere in the
tree below it and shows a themed "Something went wrong" screen instead of
unmounting to blank. It cannot catch module-evaluation-time throws (nothing
can, from inside React) or errors in async callbacks/timers outside
React's render cycle — it's one more layer, not a universal guarantee.

## Bug #3 (fixed): no error handler on `app.listen()`

Asked directly: could a clogged port / stale process cause this? Checked
live process state and `/proc/net/tcp` — at the time of checking, only one
`node server/index.mjs` was listening on port 3000, so not the active cause
that day. But the code had no defense if it ever did happen: `app.listen(...)`
had no `.on('error', ...)` handler. Per Node's `EventEmitter` contract, an
`http.Server`'s unhandled `'error'` event (e.g. `EADDRINUSE` from a stale
process still holding the port during a restart-timing overlap) rethrows as
an uncaught exception — the process dies with a generic stack trace instead
of a message that says "the port was already in use." From the browser's
side that's indistinguishable from any other kind of dead backend: no
response at all, which a webview can easily render as blank.

**First fix** (logging only) turned out to be incomplete: it made the
failure loud and clear, but this is exactly the failure that then actually
happened on a real restart — confirmed from the pasted Replit console
output: `ECHO server listening on :3000` immediately followed by
`ECHO server failed to start: port 3000 is already in use.` `npm run serve`
exited non-zero, which made the whole `npm run deploy:local` chain (and
therefore the Run button) report failure — "fails to start" was this
exact message, just scrolled past in a long build log.

The actual cause: stopping/restarting Replit's Run workflow sends the
previous process a shutdown signal, but nothing guaranteed its socket was
released before the new process started binding. A stale process mid-exit
holding the port for a few hundred ms is a **transient** race, not a
permanent conflict — treating it as fatal on the first attempt was the bug.

**Fix applied** (`server/index.mjs`): two changes.
1. On `EADDRINUSE`, retry the bind every 500ms, up to 10 times (~5s total),
   before giving up — long enough to outlast a normal prior-process
   shutdown, not indefinite.
2. Added `SIGTERM`/`SIGINT` handlers that call `httpServer.close()` for a
   clean shutdown, so the *next* restart is less likely to race in the
   first place.

Verified directly: started process A, then process B while A still held the
port — B logged `Port 3000 still in use (attempt 1/10)...` through attempt
3, then A received `SIGTERM` and exited, and B's next retry bound
successfully and served `/healthz` correctly, with no manual intervention.

## Recommendations (not yet done)

- **`scripts/smoke-test.mjs` only checks HTTP-level responses** (status
  codes, headers, that referenced assets 200). It would not have caught
  either bug above — both are client-side JS failures after a perfectly
  valid `200` response. Worth adding a headless-browser check (Chromium is
  already available via nix in this environment, see the ad hoc scripts
  used for this investigation) that actually loads the page and asserts
  `document.getElementById('root').innerHTML.length > 0` plus zero
  `Runtime.exceptionThrown` events. That would have caught Bug #1 directly
  and would catch the next silent-boot-failure class before it ships.
- **The underlying `openDatabaseSync` race is still unresolved**, only
  now visible instead of silent. If cold-boot DB failures turn out to be
  common in production (not just this analysis container), the real fix
  is migrating the web query path to `openDatabaseAsync`.
- `ai_summaries` text and audio blobs are still unencrypted even with the
  vault enabled (see SYSTEM-SPEC.md) — unrelated to boot, but adjacent and
  already flagged in WEB_FIRST_NOTES.md as a known gap.
