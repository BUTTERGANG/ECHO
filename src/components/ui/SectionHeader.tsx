import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

interface Props {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>{title.toUpperCase()}</Text>
      {action ? (
        <Text style={[styles.action, { color: theme.accent }]} onPress={action.onPress}>
          {action.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  action: { fontSize: 14, fontWeight: '600' },
});
