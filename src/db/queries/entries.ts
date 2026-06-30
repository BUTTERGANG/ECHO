/**
 * CRUD for the `entries` table (handoff §8 Step 4).
 * Soft-deleted rows (deleted_at != null) are excluded from list/get reads.
 */
import { and, desc, isNull, eq } from 'drizzle-orm';

import { db } from '../client';
import { entries, type Entry, type NewEntry } from '../schema';
import { decryptField, encryptField } from '@/services/vault';
import { isEncrypted } from '@/utils/encryption';
import { uuid } from '@/utils/idgen';

/** Decrypt the at-rest fields of a row for use in the app. */
async function decryptRow(row: Entry): Promise<Entry> {
  return { ...row, transcript: await decryptField(row.transcript) };
}

export type CreateEntryInput = Omit<NewEntry, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<NewEntry, 'id' | 'createdAt' | 'updatedAt'>>;

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  const now = Date.now();
  const plaintextTranscript = input.transcript ?? null;
  const row: NewEntry = {
    id: input.id ?? uuid(),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    ...input,
    // Encrypted at rest when the vault is unlocked; plaintext otherwise.
    transcript: await encryptField(plaintextTranscript),
  };
  const [created] = await db.insert(entries).values(row).returning();
  // Return the plaintext form for immediate UI use.
  return { ...created, transcript: plaintextTranscript };
}

export async function getEntries(opts: { limit?: number; offset?: number } = {}): Promise<Entry[]> {
  const { limit = 50, offset = 0 } = opts;
  const rows = await db
    .select()
    .from(entries)
    .where(isNull(entries.deletedAt))
    .orderBy(desc(entries.createdAt))
    .limit(limit)
    .offset(offset);
  return Promise.all(rows.map(decryptRow));
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), isNull(entries.deletedAt)))
    .limit(1);
  return row ? decryptRow(row) : undefined;
}

export async function updateEntry(
  id: string,
  patch: Partial<Omit<Entry, 'id' | 'createdAt'>>,
): Promise<Entry | undefined> {
  const set: Partial<Entry> = { ...patch, updatedAt: Date.now() };
  // Re-encrypt the transcript at rest if it's being changed.
  if (Object.prototype.hasOwnProperty.call(patch, 'transcript')) {
    set.transcript = await encryptField(patch.transcript ?? null);
  }
  const [row] = await db.update(entries).set(set).where(eq(entries.id, id)).returning();
  return row ? decryptRow(row) : undefined;
}

export async function softDeleteEntry(id: string): Promise<void> {
  await db.update(entries).set({ deletedAt: Date.now() }).where(eq(entries.id, id));
}

/**
 * Encrypt every plaintext transcript at rest. Run right after enabling the
 * vault (key in memory). Returns the number of rows changed.
 */
export async function encryptAllTranscripts(): Promise<number> {
  const rows = await db.select().from(entries);
  let changed = 0;
  for (const r of rows) {
    if (r.transcript != null && !isEncrypted(r.transcript)) {
      await db.update(entries).set({ transcript: await encryptField(r.transcript) }).where(eq(entries.id, r.id));
      changed++;
    }
  }
  return changed;
}

/**
 * Decrypt every encrypted transcript back to plaintext. Run BEFORE disabling
 * the vault, while the key is still in memory. Returns rows changed.
 */
export async function decryptAllTranscripts(): Promise<number> {
  const rows = await db.select().from(entries);
  let changed = 0;
  for (const r of rows) {
    if (isEncrypted(r.transcript)) {
      await db.update(entries).set({ transcript: await decryptField(r.transcript) }).where(eq(entries.id, r.id));
      changed++;
    }
  }
  return changed;
}
