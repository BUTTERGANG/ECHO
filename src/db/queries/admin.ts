/** Whole-database operations (export/delete-all support). */
import { db } from '../client';
import { aiSummaries, entries, habitLogs, habits } from '../schema';

/**
 * Permanently delete ALL user data from every table. Irreversible.
 * Children deleted before parents to respect foreign keys. Audio blobs live
 * in IndexedDB and must be cleared separately (see audioStore.clearAllAudio).
 */
export async function deleteAllData(): Promise<void> {
  await db.delete(habitLogs);
  await db.delete(aiSummaries);
  await db.delete(habits);
  await db.delete(entries);
}
