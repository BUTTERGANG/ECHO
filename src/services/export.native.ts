/**
 * Full data export — NATIVE (iOS/Android).
 *
 * STUB. Native will write the JSON bundle to the filesystem and hand it to the
 * share sheet (expo-file-system + expo-sharing) in the native phase. Keeps the
 * same surface as `export.ts`; Metro selects this file on native.
 */
export async function exportAllData(): Promise<string> {
  throw new Error('Data export is not wired up on native yet — see the native phase.');
}
