/**
 * On-device audio persistence — NATIVE implementation (iOS/Android).
 *
 * STUB. The native build saves recordings to the filesystem under
 * FILE_PATHS.audioDir (via expo-file-system) rather than IndexedDB, and
 * `audioPath` is a real file URI. Wired up alongside native recording in the
 * native phase. Keeps the same public surface as `audioStore.ts` so callers
 * stay platform-agnostic; Metro selects this file automatically on native.
 */

const NOT_IMPLEMENTED =
  'Native audio persistence is not wired up yet — see the native phase. ' +
  'Web stores recordings in IndexedDB; native will use the filesystem.';

export function isAudioKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && key.startsWith('file:');
}

export async function putAudio(_entryId: string, _blob: Blob): Promise<string> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function getAudioBlob(_key: string | null | undefined): Promise<Blob | null> {
  return null;
}

export async function getAudioObjectURL(_key: string | null | undefined): Promise<string | null> {
  return null;
}

export async function deleteAudio(_key: string | null | undefined): Promise<void> {
  /* no-op until native is implemented */
}

export async function clearAllAudio(): Promise<void> {
  /* no-op until native is implemented */
}
