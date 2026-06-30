import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { HabitRow } from '@/components/HabitRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useHabits } from '@/hooks/useHabits';
import { useTheme } from '@/hooks/use-theme';

export default function HabitsScreen() {
  const theme = useTheme();
  const { views, loading, toggle, add, archive } = useHabits();
  const [draft, setDraft] = useState('');

  const doneToday = views.filter((v) => v.doneToday).length;

  const onAdd = async () => {
    const label = draft.trim();
    if (!label) return;
    setDraft('');
    await add(label);
  };

  const confirmArchive = (id: string, label: string) =>
    Alert.alert('Remove habit?', `“${label}” and its history will be removed from your list.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void archive(id) },
    ]);

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: theme.text }]}>Habits</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        {views.length === 0
          ? 'Build small daily habits and check them off.'
          : `${doneToday} of ${views.length} done today`}
      </Text>

      {!loading && views.length === 0 ? (
        <EmptyState
          icon="checkbox-outline"
          title="No habits yet"
          subtitle="Add a daily habit below — meditate, walk, journal — and keep your streak going."
        />
      ) : (
        <Card padded={false} style={styles.list}>
          {views.map((v) => (
            <HabitRow
              key={v.habit.id}
              habit={v.habit}
              completed={v.doneToday}
              streak={v.streak}
              onToggle={(next) => toggle(v.habit.id, next)}
              onLongPress={() => confirmArchive(v.habit.id, v.habit.label)}
            />
          ))}
        </Card>
      )}

      <SectionHeader title="New habit" />
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="e.g. Meditate 5 min"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="done"
          onSubmitEditing={onAdd}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        />
        <Button label="Add" icon="add" onPress={onAdd} disabled={!draft.trim()} />
      </View>
      {views.length > 0 ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Tip: press and hold a habit to remove it.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: 4, marginBottom: 8 },
  list: { paddingHorizontal: 16, marginTop: 8 },
  addRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 10 },
});
