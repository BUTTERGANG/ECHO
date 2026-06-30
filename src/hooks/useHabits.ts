/**
 * Habits state for the Habits screen: active habits, today's completion, and a
 * per-habit consecutive-day streak. All date math runs inside callbacks (not
 * during render) so the hook stays render-pure.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  createHabit,
  getActiveHabits,
  getAllHabitLogs,
  setHabitLog,
  updateHabit,
} from '@/db/queries/habits';
import type { Habit, HabitLog } from '@/db/schema';
import { toISODate, todayISO } from '@/utils/dateHelpers';

/** Consecutive days (ending today, or yesterday if today isn't done yet). */
function streakFor(doneDates: Set<string>, today: string): number {
  let cursor = new Date(`${today}T00:00:00`);
  // Allow the streak to "hold" if today isn't logged yet but yesterday was.
  if (!doneDates.has(toISODate(cursor.getTime()))) {
    cursor = new Date(cursor.getTime() - 86_400_000);
    if (!doneDates.has(toISODate(cursor.getTime()))) return 0;
  }
  let streak = 0;
  while (doneDates.has(toISODate(cursor.getTime()))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

export interface HabitView {
  habit: Habit;
  doneToday: boolean;
  streak: number;
}

export function useHabits() {
  const [views, setViews] = useState<HabitView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const today = todayISO();
      const [habits, logs] = await Promise.all([getActiveHabits(), getAllHabitLogs()]);
      const doneByHabit = new Map<string, Set<string>>();
      for (const l of logs as HabitLog[]) {
        if (l.completed !== 1) continue;
        const set = doneByHabit.get(l.habitId) ?? new Set<string>();
        set.add(l.date);
        doneByHabit.set(l.habitId, set);
      }
      setViews(
        habits.map((habit) => {
          const dates = doneByHabit.get(habit.id) ?? new Set<string>();
          return { habit, doneToday: dates.has(today), streak: streakFor(dates, today) };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (habitId: string, next: boolean) => {
      // Optimistic flip for snappy feedback, then re-derive streaks from disk.
      setViews((prev) => prev.map((v) => (v.habit.id === habitId ? { ...v, doneToday: next } : v)));
      await setHabitLog(habitId, todayISO(), next);
      await refresh();
    },
    [refresh],
  );

  const add = useCallback(
    async (label: string, icon?: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      await createHabit({ label: trimmed, icon, sortOrder: views.length });
      await refresh();
    },
    [refresh, views.length],
  );

  const archive = useCallback(
    async (habitId: string) => {
      await updateHabit(habitId, { isActive: 0 });
      await refresh();
    },
    [refresh],
  );

  return { views, loading, error, toggle, add, archive, refresh };
}
