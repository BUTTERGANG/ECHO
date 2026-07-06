/**
 * SQLite connection + Drizzle client — WEB.
 *
 * Backed by sql.js (WASM SQLite) running inside a Web Worker — see
 * `./sqlWorker.ts`. sql.js is single-threaded and needs no
 * SharedArrayBuffer, so the web build works without COOP/COEP headers and
 * without cross-origin isolation. That is what lets the app run inside
 * Replit's preview iframe, where isolation can never be enabled (the
 * embedding page controls it).
 *
 * Persistence: the worker snapshots the whole database to IndexedDB on a
 * debounce after every write, and reloads it on the next boot.
 *
 * The Drizzle driver here is `sqlite-proxy` (async). Every query call site
 * in the app already `await`s its queries, so the switch from the sync
 * expo-sqlite driver (still used on native — see `client.native.ts`) is
 * transparent to callers.
 *
 * Encryption note (deviates from handoff §4.3):
 *   Native builds will layer SQLCipher on top of this connection later.
 *   The web platform has **no SQLCipher equivalent** — browser storage
 *   (IndexedDB) is origin-sandboxed but NOT encrypted at rest, beyond the
 *   field-level vault encryption in `services/vault.ts`. Known gap tracked
 *   for pre-beta.
 */
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import * as schema from './schema';

export const DATABASE_NAME = 'echo.db';

interface WorkerResponse {
  id: number;
  rows?: unknown[] | unknown[][];
  error?: string;
}

interface Pending {
  resolve: (rows: unknown[] | unknown[][] | undefined) => void;
  reject: (err: Error) => void;
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function rejectAllPending(err: Error): void {
  for (const p of pending.values()) p.reject(err);
  pending.clear();
}

function getWorker(): Worker {
  if (!worker) {
    // Metro bundles this into a separate worker chunk on web — same pattern
    // expo-sqlite's own web backend uses (`new Worker(new URL(...))`).
    worker = new Worker(new URL('./sqlWorker', window.location.href));
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const { id, rows, error } = event.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error !== undefined) p.reject(new Error(error));
      else p.resolve(rows);
    });
    // A worker-level error (script failed to load/parse, uncaught throw
    // outside a message handler) never produces a reply — without this,
    // every in-flight request would hang forever on a loading spinner.
    worker.addEventListener('error', (event) => {
      rejectAllPending(new Error(event.message || 'Database worker failed to start'));
    });
  }
  return worker;
}

function request(msg: { type: 'init' } | { type: 'query'; sql: string; params: unknown[]; method: string }) {
  return new Promise<unknown[] | unknown[][] | undefined>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, ...msg });
  });
}

/**
 * Kick off (or await) the worker's one-time setup: load sql.js, restore the
 * persisted database from IndexedDB, run pending migrations. `migrate.ts`
 * calls this from the root layout and gates rendering on it.
 */
export function initDb(): Promise<void> {
  return request({ type: 'init' }).then(() => undefined);
}

/**
 * Discard the current worker so the next call starts a fresh attempt. Used
 * by the UI retry path: a failed init (e.g. a transient CDN fetch failure
 * loading sql.js) is cached inside the worker, so retrying needs a new one.
 */
export function resetDb(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  rejectAllPending(new Error('Database was reset'));
}

export type DB = ReturnType<typeof drizzle<typeof schema>>;

export const db: DB = drizzle(async (sql, params, method) => {
  const rows = await request({ type: 'query', sql, params, method });
  // `get` with no matching row comes back as undefined; drizzle expects rows.
  return { rows: (rows ?? []) as unknown[] };
}, { schema });

export { schema };
