import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Habit } from '@/db/schema';

interface Props {
  habit: Habit;
  completed: boolean;
  onToggle: (next: boolean) => void;
}

/** Single habit check-in row (handoff §8 Step 7). */
export function HabitRow({ habit, completed, onToggle }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={habit.label}
      onPress={() => onToggle(!completed)}
      style={[styles.row, { borderColor: theme.border }]}>
      <View style={styles.left}>
        {habit.icon ? <Text style={styles.icon}>{habit.icon}</Text> : null}
        <Text style={[styles.label, { color: theme.text }]}>{habit.label}</Text>
      </View>
      <View
        style={[
          styles.check,
          { borderColor: theme.border },
          completed && { backgroundColor: theme.success, borderColor: theme.success },
        ]}>
        {completed ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
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
  check: {
    width: 26,
    height: 26,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
