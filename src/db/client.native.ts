/**
 * SQLite connection + Drizzle client — NATIVE (iOS/Android).
 *
 * Native `openDatabaseSync` is backed by real on-device SQLite and returns
 * immediately; none of the web build's WASM/Worker startup latency applies
 * here, so this stays a plain, eager connection.
 *
 * Encryption note (deviates from handoff §4.3):
 *   Native builds will layer SQLCipher on top of this connection later.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'echo.db';

export type DB = ReturnType<typeof drizzle<typeof schema>>;

const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

export const db: DB = drizzle(sqlite, { schema });

/**
 * No-op on native. On web (`client.ts`) this tears down the database worker
 * so the UI retry path can start a fresh init attempt; the native connection
 * is eager and never needs it, but the root layout imports it on both
 * platforms so the export must exist here too.
 */
export function resetDb(): void {}

export { schema };
