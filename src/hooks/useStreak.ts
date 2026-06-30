/**
 * Current streak = consecutive local days (ending today or yesterday) that
 * have at least one entry (handoff §8 Step 8).
 */
import { useMemo } from 'react';

import { toISODate } from '@/utils/dateHelpers';
import { useEntryStore } from '@/stores/entryStore';

export function useStreak(): number {
  const entries = useEntryStore((s) => s.entries);

  return useMemo(() => {
    if (entries.length === 0) return 0;

    const days = new Set(entries.map((e) => toISODate(e.createdAt)));
    const now = Date.now();
    // A streak is "live" if there's an entry today or yesterday.
    let cursor = days.has(toISODate(now))
      ? now
      : days.has(toISODate(now - 86_400_000))
        ? now - 86_400_000
        : null;
    if (cursor === null) return 0;

    let streak = 0;
    while (days.has(toISODate(cursor))) {
      streak++;
      cursor -= 86_400_000;
    }
    return streak;
  }, [entries]);
}
