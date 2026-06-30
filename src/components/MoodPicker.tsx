import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MoodColors, MoodEmoji, Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  label?: string;
  value: number | null;
  onChange: (value: number) => void;
}

/** 1–5 mood selector with emoji + color (handoff §8 Step 5). */
export function MoodPicker({ label = 'How are you feeling?', value, onChange }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((score) => {
          const selected = value === score;
          return (
            <Pressable
              key={score}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Mood ${score} of 5`}
              onPress={() => onChange(score)}
              style={[
                styles.item,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                selected && { backgroundColor: MoodColors[score], borderColor: MoodColors[score] },
              ]}>
              <Text style={[styles.emoji, selected && styles.emojiSelected]}>{MoodEmoji[score]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 10 },
  item: {
    width: 52,
    height: 52,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24, opacity: 0.7 },
  emojiSelected: { opacity: 1 },
});
