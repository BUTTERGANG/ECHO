/**
 * Full-text search over entry transcripts (FTS4 — see migration 0001 for why
 * not FTS5).
 *
 * The `entries_fts` virtual table is a plaintext shadow of `entries.transcript`,
 * so it must never contain a row for an entry whose transcript is stored
 * encrypted (vault.ts) — that would persist an unencrypted copy of "encrypted"
 * content to disk, defeating the vault. Encrypted entries are excluded from
 * the persisted index entirely; while the vault is unlocked, `searchEntries`
 * covers them with an in-memory linear scan instead (slower, no ranking, but
 * nothing extra written to disk).
 *
 * The index is maintained here rather than via SQL triggers because "is this
 * transcript currently stored encrypted" depends on the vault's in-memory
 * unlock state, which triggers have no visibility into.
 */
import { desc, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '../client';
import { entries, type Entry } from '../schema';
import { decryptField, isUnlocked } from '@/services/vault';
import { isEncrypted } from '@/utils/encryption';

/** Normalizes the two raw-row shapes drizzle's sqlite drivers return for an
 * un-mapped `sql` query: native (expo-sqlite) yields column-keyed objects,
 * web (sqlite-proxy, see client.ts) yields positional value arrays. */
function firstColumn(row: unknown): string {
  return String(Array.isArray(row) ? row[0] : (row as Record<string, unknown>).entry_id);
}

/** Tokenize into a simple AND-of-prefixes FTS4 MATCH expression, stripping
 * everything but letters/digits so user input can't break FTS query syntax. */
function toMatchQuery(raw: string): string | null {
  const terms = raw
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  return terms.length ? terms.map((t) => `${t}*`).join(' ') : null;
}

/** Insert or refresh the FTS row for an entry. FTS4 has no UPDATE-by-match, so
 * this always deletes first. */
async function upsertFtsEntry(id: string, transcript: string): Promise<void> {
  await db.run(sql`DELETE FROM entries_fts WHERE entry_id = ${id}`);
  await db.run(sql`INSERT INTO entries_fts (entry_id, transcript) VALUES (${id}, ${transcript})`);
}

async function removeFtsEntry(id: string): Promise<void> {
  await db.run(sql`DELETE FROM entries_fts WHERE entry_id = ${id}`);
}

/**
 * Keep the FTS index consistent with what `entries.transcript` actually
 * stores for this row: indexed in plaintext if the stored value isn't
 * encrypted, excluded otherwise. Call after any write that changes
 * `transcript` (including its encrypted-ness).
 */
export async function syncFtsForEntry(
  id: string,
  storedTranscript: string | null | undefined,
  plaintextTranscript: string | null | undefined,
): Promise<void> {
  if (plaintextTranscript && !isEncrypted(storedTranscript)) {
    await upsertFtsEntry(id, plaintextTranscript);
  } else {
    await removeFtsEntry(id);
  }
}

/** Drop the whole index. Call after encrypting every transcript at rest —
 * nothing should remain indexed in plaintext once the vault owns the column. */
export async function clearFtsIndex(): Promise<void> {
  await db.run(sql`DELETE FROM entries_fts`);
}

/** Rebuild the index from every currently-plaintext transcript. Call after
 * decrypting all transcripts back to plaintext (vault disabled). */
export async function reindexPlaintextEntries(): Promise<void> {
  await clearFtsIndex();
  const rows = await db
    .select({ id: entries.id, transcript: entries.transcript })
    .from(entries)
    .where(isNull(entries.deletedAt));
  for (const row of rows) {
    if (row.transcript && !isEncrypted(row.transcript)) {
      await upsertFtsEntry(row.id, row.transcript);
    }
  }
}

/**
 * Self-heal pass for entries that predate this feature (or missed an index
 * write for any other reason). Cheap: only indexes rows not already present.
 * Safe to call on every app start.
 */
export async function ensureFtsIndexed(): Promise<void> {
  const existing = await db.all(sql`SELECT entry_id FROM entries_fts`);
  const indexed = new Set(existing.map(firstColumn));
  const rows = await db
    .select({ id: entries.id, transcript: entries.transcript })
    .from(entries)
    .where(isNull(entries.deletedAt));
  for (const row of rows) {
    if (indexed.has(row.id)) continue;
    if (row.transcript && !isEncrypted(row.transcript)) {
      await upsertFtsEntry(row.id, row.transcript);
    }
  }
}

/**
 * Search entry transcripts. Matches the persisted FTS index (unencrypted
 * transcripts) plus, when the vault is currently unlocked, a linear scan over
 * encrypted transcripts decrypted in memory. Results are entries the caller
 * would otherwise see via `getEntries` (soft-deleted rows excluded).
 */
export async function searchEntries(query: string, limit = 50): Promise<Entry[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const matchedIds = new Set<string>();

  const matchQuery = toMatchQuery(trimmed);
  if (matchQuery) {
    const rows = await db.all(sql`SELECT entry_id FROM entries_fts WHERE entries_fts MATCH ${matchQuery}`);
    for (const row of rows) matchedIds.add(firstColumn(row));
  }

  if (isUnlocked()) {
    const needle = trimmed.toLowerCase();
    const rows = await db
      .select({ id: entries.id, transcript: entries.transcript })
      .from(entries)
      .where(isNull(entries.deletedAt));
    for (const row of rows) {
      if (matchedIds.has(row.id) || !isEncrypted(row.transcript)) continue;
      const plain = await decryptField(row.transcript);
      if (plain?.toLowerCase().includes(needle)) matchedIds.add(row.id);
    }
  }

  if (matchedIds.size === 0) return [];

  const rows = await db
    .select()
    .from(entries)
    .where(inArray(entries.id, [...matchedIds]))
    .orderBy(desc(entries.createdAt))
    .limit(limit);

  return Promise.all(rows.map(async (row) => ({ ...row, transcript: await decryptField(row.transcript) })));
}
