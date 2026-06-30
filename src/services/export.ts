/**
 * Full data export — WEB (handoff §8 Step 10, principle §2.4 "your data is yours").
 *
 * Gathers all entries (decrypted for the export), AI summaries, habits, and
 * habit logs into a single JSON file and triggers a browser download. Audio
 * blobs live in IndexedDB and are intentionally excluded — this is the text +
 * metadata record. Native resolves to `export.native.ts`.
 */
import { getEntries } from '@/db/queries/entries';
import { getActiveHabits, getAllHabitLogs } from '@/db/queries/habits';
import { getAllSummaries } from '@/db/queries/summaries';
import { toISODate } from '@/utils/dateHelpers';

/** Builds the export bundle and downloads it. Returns the file name used. */
export async function exportAllData(): Promise<string> {
  const [entries, summaries, habits, habitLogs] = await Promise.all([
    getEntries({ limit: 1_000_000 }),
    getAllSummaries(),
    getActiveHabits(),
    getAllHabitLogs(),
  ]);

  const payload = {
    app: 'ECHO',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    note: 'Audio recordings are stored locally and are not included in this export.',
    counts: {
      entries: entries.length,
      summaries: summaries.length,
      habits: habits.length,
      habitLogs: habitLogs.length,
    },
    entries,
    summaries,
    habits,
    habitLogs,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const fileName = `echo-export-${toISODate()}.json`;
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return fileName;
}
