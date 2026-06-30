/**
 * GitHub-style mood heatmap: one cell per day, colored by that day's average
 * mood. Columns are weeks (Monday-started), most recent on the right. Pure
 * local data viz — no AI. The grid is built in an effect so no impure date
 * call happens during render.
 */
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MoodColors } from '@/constants/theme';
import { toISODate } from '@/utils/dateHelpers';
import { useTheme } from '@/hooks/use-theme';
import type { Entry } from '@/db/schema';

interface Cell {
  date: string;
  mood: number | null; // rounded 1–5, or null for no entry / future day
  future: boolean;
}

const CELL = 13;
const GAP = 4;
const DAY = 86_400_000;

export function MoodHeatmap({ entries, weeks = 13 }: { entries: Entry[]; weeks?: number }) {
  const theme = useTheme();
  const [grid, setGrid] = useState<Cell[][]>([]);

  useEffect(() => {
    // Average mood per ISO day.
    const sum = new Map<string, { total: number; n: number }>();
    for (const e of entries) {
      if (!e.moodScore) continue;
      const key = toISODate(e.createdAt);
      const cur = sum.get(key) ?? { total: 0, n: 0 };
      cur.total += e.moodScore;
      cur.n += 1;
      sum.set(key, cur);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // Monday = 0
    const startMonday = new Date(today.getTime() - (dow + (weeks - 1) * 7) * DAY);

    const cols: Cell[][] = [];
    for (let w = 0; w < weeks; w++) {
      const col: Cell[] = [];
      for (let d = 0; d < 7; d++) {
        const t = startMonday.getTime() + (w * 7 + d) * DAY;
        const iso = toISODate(t);
        const agg = sum.get(iso);
        col.push({
          date: iso,
          mood: agg ? Math.max(1, Math.min(5, Math.round(agg.total / agg.n))) : null,
          future: t > today.getTime(),
        });
      }
      cols.push(col);
    }
    setGrid(cols);
  }, [entries, weeks]);

  const cellColor = (c: Cell): string => {
    if (c.future) return 'transparent';
    if (c.mood == null) return theme.backgroundElement;
    return MoodColors[c.mood];
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {grid.map((col) => (
          <View key={col[0]?.date} style={styles.col}>
            {col.map((cell) => (
              <View
                key={cell.date}
                style={[styles.cell, { backgroundColor: cellColor(cell) }]}
                accessibilityLabel={
                  cell.mood ? `${cell.date}: mood ${cell.mood} of 5` : undefined
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>Low</Text>
        {[1, 2, 3, 4, 5].map((m) => (
          <View key={m} style={[styles.cell, { backgroundColor: MoodColors[m] }]} />
        ))}
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>High</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: GAP, paddingVertical: 4 },
  col: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: GAP, marginTop: 10 },
  legendText: { fontSize: 12, marginHorizontal: 4 },
});
