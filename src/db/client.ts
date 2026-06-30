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

// `openDatabaseSync` works on web once Metro is configured for wasm + the
// COOP/COEP headers are present (see metro.config.js).
export const sqlite = openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true,
});

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
export { schema };
