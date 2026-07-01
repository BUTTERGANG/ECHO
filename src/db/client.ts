/**
 * SQLite connection + Drizzle client.
 *
 * `expo-sqlite` exposes the same API on native and web (web is backed by
 * wa-sqlite/OPFS). The Drizzle wrapper is therefore identical across
 * platforms.
 *
 * Encryption note (deviates from handoff §4.3):
 *   Native builds will layer SQLCipher on top of this connection later.
 *   The web platform has **no SQLCipher equivalent** — browser storage
 *   (OPFS/IndexedDB) is origin-sandboxed but NOT encrypted at rest. This is
 *   a known gap tracked for pre-beta; do not treat the web build as
 *   meeting the "encrypted local storage" principle yet.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'echo.db';

export type DB = ReturnType<typeof drizzle<typeof schema>>;

let real: DB | undefined;
let initError: Error | undefined;

// `openDatabaseSync` works on web once Metro is configured for wasm + the
// COOP/COEP headers are present (see metro.config.js). On web it can also
// throw `Sync operation timeout` on a cold, CPU-constrained boot (see
// DEPLOY.md) — calling it lazily, on first real use rather than at module
// load, means that throw happens inside useRunMigrations' effect (via the
// `db` access below), where drizzle-orm's useMigrations hook already
// catches it into an `error` state that _layout.tsx renders. Calling it
// eagerly at module load throws before React has mounted anything to catch
// it with, producing a silent blank screen instead.
//
// A timeout here does not mean the worker is stuck: expo-sqlite's web
// SQLiteModule caches a single Worker for the page's lifetime (see
// `getWorker()` there), so the worker's one-time WASM+OPFS setup keeps
// running in the background even after the main thread's busy-wait gives up
// on it. Retrying re-enters the wait against that same, already-warming-up
// worker, so a retry is very likely to succeed once — not a fresh race each
// time. No artificial delay between attempts: the prior attempt's own
// busy-wait already consumed real wall-clock time the worker could use.
//
// (A separate `openDatabaseAsync` warm-up fired at module load was tried
// here and reverted: it raced the sync path below before the worker's
// same-options cache registration completed, producing a different and
// worse failure than the one it was meant to avoid. Not worth the risk for
// an unconfirmed win — the retry loop alone is the safer bet.)
// Keep attempts low enough that the busy-wait doesn't freeze the browser
// for too long. Each attempt gives the worker ~1–2 s via the patched
// iteration cap; 5 attempts = ~5–10 s before we surface the error and let
// the UI retry with a small delay (giving the still-warming worker more
// wall-clock time without blocking the main thread).
const OPEN_DB_ATTEMPTS = 5;

function getDb(): DB {
  if (real) return real;
  if (initError) throw initError;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= OPEN_DB_ATTEMPTS; attempt++) {
    try {
      const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
      real = drizzle(sqlite, { schema });
      return real;
    } catch (err) {
      lastErr = err;
    }
  }
  initError = lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  throw initError;
}

/**
 * Reset the cached DB instance and any cached init error so the next
 * `getDb()` call starts a fresh attempt. Used by the UI retry path on web:
 * after a "Sync operation timeout" the wa-sqlite worker keeps warming up in
 * the background, so a short delay + retry often succeeds.
 */
export function resetDb(): void {
  real = undefined;
  initError = undefined;
}

// Proxy so existing call sites (`db.select(...)`, `db.insert(...)`, etc.)
// don't need to change: property access lazily triggers `getDb()`, and
// methods are bound to the real instance so drizzle's internal `this` /
// private-field usage still works correctly.
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export { schema };
