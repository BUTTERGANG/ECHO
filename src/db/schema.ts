/**
 * Drizzle schema for ECHO — Phase 1 (MVP) tables.
 *
 * Mirrors the SQL in the handoff doc §4.1. Phase 2+ tables (`patterns`,
 * `weekly_reviews`) are intentionally omitted until that work begins.
 *
 * Conventions:
 *  - Timestamps are Unix epoch milliseconds stored as INTEGER.
 *  - Booleans are 0/1 INTEGER columns (SQLite has no native boolean).
 *  - JSON-shaped columns (tags, entry_ids) are TEXT holding a JSON string.
 */
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Primary record for each journaling session. */
export const entries = sqliteTable('entries', {
  id: text('id').primaryKey(), // UUID v4
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  audioPath: text('audio_path'), // local file path / web object key
  transcript: text('transcript'), // Whisper output, plain text
  durationMs: integer('duration_ms'),
  whisperModel: text('whisper_model'), // 'base' | 'small' | 'large-v3'
  isPrivate: integer('is_private').notNull().default(0), // 1 = excluded from AI/sync
  moodScore: integer('mood_score'), // 1–5, null if not logged
  energyLevel: integer('energy_level'), // 1–5, null if not logged
  tags: text('tags'), // JSON array of user-defined tags
  deletedAt: integer('deleted_at'), // soft delete (null = active)
});

/**
 * AI summaries from the Claude API. Stored separately from `entries` so they
 * can be regenerated or deleted without touching the source entry.
 */
export const aiSummaries = sqliteTable('ai_summaries', {
  id: text('id').primaryKey(),
  entryId: text('entry_id')
    .notNull()
    .references(() => entries.id),
  createdAt: integer('created_at').notNull(),
  model: text('model').notNull(), // Claude model string used
  whatSaid: text('what_said'),
  unseen: text('unseen'),
  action: text('action'),
  rawResponse: text('raw_response'), // full JSON response from Claude
  promptVersion: text('prompt_version'), // which prompt template generated this
});

/** User-defined daily habits to track. */
export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  label: text('label').notNull(),
  icon: text('icon'), // emoji or icon name
  isActive: integer('is_active').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** Daily habit check-ins. One row per (habit, day). */
export const habitLogs = sqliteTable(
  'habit_logs',
  {
    id: text('id').primaryKey(),
    habitId: text('habit_id')
      .notNull()
      .references(() => habits.id),
    date: text('date').notNull(), // ISO date 'YYYY-MM-DD'
    completed: integer('completed').notNull().default(0),
  },
  (t) => ({
    habitDateUnique: uniqueIndex('habit_logs_habit_date_unique').on(t.habitId, t.date),
  }),
);

// Inferred row types for use across queries/services.
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type AiSummary = typeof aiSummaries.$inferSelect;
export type NewAiSummary = typeof aiSummaries.$inferInsert;
export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
export type HabitLog = typeof habitLogs.$inferSelect;
export type NewHabitLog = typeof habitLogs.$inferInsert;
