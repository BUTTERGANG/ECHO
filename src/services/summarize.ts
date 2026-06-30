/**
 * Orchestrates AI summary generation + persistence for an entry, respecting
 * the opt-in setting and the absolute private-entry exclusion (§2.5 / §5.5).
 *
 * Errors are swallowed quietly per §12.1 — a failed summary must never block
 * saving the entry itself.
 */
import { createSummary } from '@/db/queries/summaries';
import { generateEntrySummary } from '@/services/claude';
import type { Entry } from '@/db/schema';

export async function maybeSummarizeEntry(entry: Entry, aiEnabled: boolean): Promise<void> {
  if (!aiEnabled) return;
  if (entry.isPrivate === 1) return; // private entries never reach the API
  const transcript = (entry.transcript ?? '').trim();
  if (!transcript) return;

  try {
    const result = await generateEntrySummary(transcript);
    await createSummary({
      entryId: entry.id,
      model: result.model,
      whatSaid: result.summary.whatSaid,
      unseen: result.summary.unseen,
      action: result.summary.action,
      rawResponse: result.raw,
      promptVersion: result.promptVersion,
    });
  } catch {
    // Quiet failure: entry is already saved; summary can be regenerated later.
  }
}
