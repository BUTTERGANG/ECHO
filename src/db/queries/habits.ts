/** CRUD for `habits` and `habit_logs` (handoff §8 Step 7). */
import { and, asc, eq } from 'drizzle-orm';

import { db } from '../client';
import { habitLogs, habits, type Habit, type HabitLog, type NewHabit } from '../schema';
import { uuid } from '@/utils/idgen';

export type CreateHabitInput = Omit<NewHabit, 'id' | 'createdAt'> &
  Partial<Pick<NewHabit, 'id' | 'createdAt'>>;

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const [created] = await db
    .insert(habits)
    .values({ id: input.id ?? uuid(), createdAt: input.createdAt ?? Date.now(), ...input })
    .returning();
  return created;
}

export async function getActiveHabits(): Promise<Habit[]> {
  return db
    .select()
    .from(habits)
    .where(eq(habits.isActive, 1))
    .orderBy(asc(habits.sortOrder));
}

export async function updateHabit(
  id: string,
  patch: Partial<Omit<Habit, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.update(habits).set(patch).where(eq(habits.id, id));
}

/** Toggle/set a habit's completion for a given ISO date ('YYYY-MM-DD'). */
export async function setHabitLog(
  habitId: string,
  date: string,
  completed: boolean,
): Promise<HabitLog> {
  const [row] = await db
    .insert(habitLogs)
    .values({ id: uuid(), habitId, date, completed: completed ? 1 : 0 })
    .onConflictDoUpdate({
      target: [habitLogs.habitId, habitLogs.date],
      set: { completed: completed ? 1 : 0 },
    })
    .returning();
  return row;
}

export async function getHabitLogsForDate(date: string): Promise<HabitLog[]> {
  return db.select().from(habitLogs).where(eq(habitLogs.date, date));
}

/** Every habit log (used by data export). */
export async function getAllHabitLogs(): Promise<HabitLog[]> {
  return db.select().from(habitLogs);
}

/** Logs for one habit across all dates (used for per-habit streaks). */
export async function getHabitLogs(habitId: string): Promise<HabitLog[]> {
  return db.select().from(habitLogs).where(eq(habitLogs.habitId, habitId));
}

export async function getHabitLog(habitId: string, date: string): Promise<HabitLog | undefined> {
  const [row] = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)))
    .limit(1);
  return row;
}
