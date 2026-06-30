import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Current streak pill (handoff §8 Step 8). */
export function StreakBadge({ streak }: { streak: number }) {
  const theme = useTheme();
  const active = streak > 0;
  return (
    <View style={[styles.wrap, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="flame" size={16} color={active ? theme.warning : theme.textSecondary} />
      <Text style={[styles.text, { color: theme.text }]}>
        {streak} day{streak === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  text: { fontSize: 14, fontWeight: '700' },
});
