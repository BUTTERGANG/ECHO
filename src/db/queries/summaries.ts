/** CRUD for the `ai_summaries` table (handoff §8 Step 6). */
import { desc, eq } from 'drizzle-orm';

import { db } from '../client';
import { aiSummaries, type AiSummary, type NewAiSummary } from '../schema';
import { uuid } from '@/utils/idgen';

export type CreateSummaryInput = Omit<NewAiSummary, 'id' | 'createdAt'> &
  Partial<Pick<NewAiSummary, 'id' | 'createdAt'>>;

export async function createSummary(input: CreateSummaryInput): Promise<AiSummary> {
  const [created] = await db
    .insert(aiSummaries)
    .values({ id: input.id ?? uuid(), createdAt: input.createdAt ?? Date.now(), ...input })
    .returning();
  return created;
}

/** Most recent summary for an entry (summaries can be regenerated). */
export async function getSummaryByEntryId(entryId: string): Promise<AiSummary | undefined> {
  const [row] = await db
    .select()
    .from(aiSummaries)
    .where(eq(aiSummaries.entryId, entryId))
    .orderBy(desc(aiSummaries.createdAt))
    .limit(1);
  return row;
}
