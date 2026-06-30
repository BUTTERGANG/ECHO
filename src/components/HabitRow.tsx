import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Habit } from '@/db/schema';

interface Props {
  habit: Habit;
  completed: boolean;
  onToggle: (next: boolean) => void;
  /** Current consecutive-day streak; shows a flame chip when > 0. */
  streak?: number;
  /** Optional long-press handler (e.g. remove the habit). */
  onLongPress?: () => void;
}

/** Single habit check-in row (handoff §8 Step 7). */
export function HabitRow({ habit, completed, onToggle, streak = 0, onLongPress }: Props) {
  const theme = useTheme();
  const a11yLabel = streak > 0 ? `${habit.label}, ${streak} day streak` : habit.label;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={a11yLabel}
      onPress={() => onToggle(!completed)}
      onLongPress={onLongPress}
      style={[styles.row, { borderColor: theme.border }]}>
      <View style={styles.left}>
        {habit.icon ? <Text style={styles.icon}>{habit.icon}</Text> : null}
        <Text style={[styles.label, { color: theme.text }]}>{habit.label}</Text>
      </View>
      <View style={styles.right}>
        {streak > 0 ? (
          <View style={styles.streak}>
            <Ionicons name="flame" size={13} color={theme.warning} />
            <Text style={[styles.streakText, { color: theme.textSecondary }]}>{streak}</Text>
          </View>
        ) : null}
        <View
          style={[
            styles.check,
            { borderColor: theme.border },
            completed && { backgroundColor: theme.success, borderColor: theme.success },
          ]}>
          {completed ? <Ionicons name="checkmark" size={16} color={theme.accentText} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  icon: { fontSize: 18 },
  label: { fontSize: 16 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  streakText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  check: {
    width: 26,
    height: 26,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
