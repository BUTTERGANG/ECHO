/**
 * Resolves the current time-of-day period and its accent tint. The clock read
 * happens in an effect (not during render) to keep the hook render-pure, and
 * refreshes every minute so the app shifts as the day moves — e.g. morning
 * warmth easing into evening calm.
 */
import { useEffect, useState } from 'react';

import { TimeOfDayTints, type TimeOfDay } from '@/constants/theme';

function periodForHour(h: number): TimeOfDay {
  if (h < 6) return 'night';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

export function useTimeOfDay(): { period: TimeOfDay | null; tint: string | null } {
  // Null until the first effect runs so no impure Date call happens in render.
  const [period, setPeriod] = useState<TimeOfDay | null>(null);

  useEffect(() => {
    const update = () => setPeriod(periodForHour(new Date().getHours()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  return { period, tint: period ? TimeOfDayTints[period] : null };
}
