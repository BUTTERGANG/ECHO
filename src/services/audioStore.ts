/**
 * On-device audio persistence — WEB implementation.
 *
 * Recorded audio blobs are stored in IndexedDB (not the SQLite DB) so the
 * binary stays out of the row data and survives reloads. Entries reference a
 * blob by an opaque `audioPath` key of the form `idb:<entryId>`; downstream
 * code treats it as a string and never inspects it.
 *
 * Audio never leaves the device — preserving handoff principle §2.1 on web.
 * Native (iOS/Android) resolves to `audioStore.native.ts` (filesystem).
 */

const DB_NAME = 'echo-audio';
const STORE = 'clips';
const KEY_PREFIX = 'idb:';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
  return dbPromise;
}

/** Run a single keyed operation inside a transaction and resolve its result. */
function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = run(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

/** True for keys this store owns (defensive: native uses a different scheme). */
export function isAudioKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && key.startsWith(KEY_PREFIX);
}

/** Persist a recorded blob for an entry. Returns the opaque `audioPath` key. */
export async function putAudio(entryId: string, blob: Blob): Promise<string> {
  const key = `${KEY_PREFIX}${entryId}`;
  await tx('readwrite', (s) => s.put(blob, key));
  return key;
}

/** Fetch the stored blob for a key, or null if it's missing/not an idb key. */
export async function getAudioBlob(key: string | null | undefined): Promise<Blob | null> {
  if (!isAudioKey(key)) return null;
  const blob = await tx<Blob | undefined>('readonly', (s) => s.get(key));
  return blob ?? null;
}

/**
 * Object URL for the stored blob, suitable for an <audio> element or as the
 * input to the Whisper pipeline. Caller MUST `URL.revokeObjectURL` when done.
 */
export async function getAudioObjectURL(key: string | null | undefined): Promise<string | null> {
  const blob = await getAudioBlob(key);
  return blob ? URL.createObjectURL(blob) : null;
}

/** Delete the stored blob for a key (no-op if absent). */
export async function deleteAudio(key: string | null | undefined): Promise<void> {
  if (!isAudioKey(key)) return;
  await tx('readwrite', (s) => s.delete(key));
}
