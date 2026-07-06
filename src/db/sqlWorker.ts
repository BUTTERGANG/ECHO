/**
 * SQL.js worker — backend for the WEB database (see `client.ts`).
 *
 * Runs sql.js (WASM SQLite, single-threaded, no Atomics/SharedArrayBuffer) so
 * the web build needs no COOP/COEP headers and no cross-origin-isolation
 * story at all — unlike `expo-sqlite`'s wa-sqlite backend, which requires
 * both. The whole database lives in this worker's WASM heap; every write is
 * (debounced-)persisted as a serialized blob to IndexedDB, and reloaded from
 * there on the next boot.
 *
 * sql.js is loaded from a CDN at runtime, not bundled — same technique as
 * `services/whisper.ts` uses for transformers.js, and for the same reason:
 * Metro can't statically bundle it, so an indirect `import()` hides the
 * specifier from the bundler entirely.
 *
 * Migrations reuse the exact migrations bundle drizzle-kit generates for the
 * native `expo` driver (`./migrations/migrations`) and replicate the same
 * `__drizzle_migrations` bookkeeping drizzle's own migrators use, so both
 * platforms apply the same SQL from the same source of truth.
 */
import migrationsData from './migrations/migrations';

const SQLJS_VERSION = '1.11.0';
const SQLJS_DIST = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist/`;
const SQLJS_MODULE = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/+esm`;

// Hides the CDN specifier from Metro's static import resolution.
const importRemote = new Function('u', 'return import(u)') as (u: string) => Promise<{ default: SqlJsInit }>;

interface SqlJsStatement {
  bind(params: unknown[]): void;
  step(): boolean;
  get(): unknown[];
  free(): void;
}
interface SqlJsDatabaseInstance {
  run(sql: string): void;
  prepare(sql: string): SqlJsStatement;
  export(): Uint8Array;
}
interface SqlJsStatic {
  Database: new (data?: Uint8Array) => SqlJsDatabaseInstance;
}
type SqlJsInit = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

const workerSelf = self as unknown as Worker;

const IDB_NAME = 'echo-sqljs';
const IDB_STORE = 'db';
const IDB_KEY = 'echo.db';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function loadPersisted(): Promise<Uint8Array | undefined> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result ?? undefined);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
  });
}

async function persistNow(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
  });
}

/** Runs a statement and collects every result row as a flat value array. */
function execRaw(database: SqlJsDatabaseInstance, sqlText: string, params: unknown[] = []): unknown[][] {
  const stmt = database.prepare(sqlText);
  try {
    if (params.length) stmt.bind(params);
    const rows: unknown[][] = [];
    while (stmt.step()) rows.push(stmt.get());
    return rows;
  } finally {
    stmt.free();
  }
}

/** Mirrors drizzle's own `__drizzle_migrations` bookkeeping (see sqlite-core dialect.migrate). */
function runMigrations(database: SqlJsDatabaseInstance): void {
  database.run(
    `CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)`,
  );
  const last = execRaw(database, `SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`);
  const lastMillis = last.length ? Number(last[0][0]) : undefined;

  for (const entry of migrationsData.journal.entries) {
    if (lastMillis !== undefined && lastMillis >= entry.when) continue;
    const key = `m${String(entry.idx).padStart(4, '0')}`;
    const sqlText = (migrationsData.migrations as Record<string, string>)[key];
    if (!sqlText) throw new Error(`Missing migration: ${entry.tag}`);
    for (const stmt of sqlText.split('--> statement-breakpoint')) {
      const trimmed = stmt.trim();
      if (trimmed) database.run(trimmed);
    }
    execRaw(database, `INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`, ['', entry.when]);
  }
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = importRemote(SQLJS_MODULE).then((mod) =>
      mod.default({ locateFile: (file) => `${SQLJS_DIST}${file}` }),
    );
  }
  return sqlJsPromise;
}

let dbInstance: SqlJsDatabaseInstance | null = null;
let initPromise: Promise<void> | null = null;
function getInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const SQL = await getSqlJs();
      const persisted = await loadPersisted();
      dbInstance = persisted ? new SQL.Database(persisted) : new SQL.Database();
      runMigrations(dbInstance);
      // Always persist post-migration: covers both a brand-new DB and an
      // existing one that just had a newly-added migration applied to it.
      await persistNow(dbInstance.export());
    })();
  }
  return initPromise;
}

// Debounced so a burst of writes (e.g. an import) serializes the whole DB
// once, not once per statement.
const PERSIST_DEBOUNCE_MS = 250;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(database: SqlJsDatabaseInstance): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistNow(database.export()).catch(() => {
      // Best-effort: a failed persist just means the next write's debounce
      // window will retry with an up-to-date export.
    });
  }, PERSIST_DEBOUNCE_MS);
}

const WRITE_SQL_RE = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i;

type IncomingMessage =
  | { id: number; type: 'init' }
  | { id: number; type: 'query'; sql: string; params: unknown[]; method: 'run' | 'all' | 'values' | 'get' };

workerSelf.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;
  try {
    await getInit();
    if (msg.type === 'init') {
      workerSelf.postMessage({ id: msg.id, rows: [] });
      return;
    }
    const database = dbInstance!;
    const rows = execRaw(database, msg.sql, msg.params);
    if (WRITE_SQL_RE.test(msg.sql)) schedulePersist(database);
    workerSelf.postMessage({ id: msg.id, rows: msg.method === 'get' ? rows[0] : rows });
  } catch (err) {
    workerSelf.postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) });
  }
});
