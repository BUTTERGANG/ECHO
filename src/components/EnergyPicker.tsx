import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EnergyColors, EnergyIcons, EnergyLabels, Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  label?: string;
  value: number | null;
  onChange: (value: number) => void;
}

/** Low / Medium / High energy selector (levels 1–3), companion to MoodPicker. */
export function EnergyPicker({ label = "What's your energy?", value, onChange }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <View style={styles.row}>
        {[1, 2, 3].map((level) => {
          const selected = value === level;
          return (
            <Pressable
              key={level}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Energy ${EnergyLabels[level]}`}
              onPress={() => onChange(level)}
              style={[
                styles.item,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                selected && { backgroundColor: EnergyColors[level], borderColor: EnergyColors[level] },
              ]}>
              <Ionicons
                name={EnergyIcons[level] as keyof typeof Ionicons.glyphMap}
                size={18}
                color={selected ? '#1A1D23' : theme.textSecondary}
              />
              <Text style={[styles.itemText, { color: selected ? '#1A1D23' : theme.text }]}>
                {EnergyLabels[level]}
              </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  itemText: { fontSize: 14, fontWeight: '600' },
});
