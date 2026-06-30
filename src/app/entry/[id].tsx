import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { AudioPlayer } from '@/components/AudioPlayer';
import { SummaryBlock } from '@/components/SummaryBlock';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { MoodColors, MoodEmoji } from '@/constants/theme';
import { getEntry, softDeleteEntry, updateEntry } from '@/db/queries/entries';
import { getSummaryByEntryId } from '@/db/queries/summaries';
import type { AiSummary, Entry } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { useEntryStore } from '@/stores/entryStore';

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EntryDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const setEntries = useEntryStore((s) => s.setEntries);
  const entries = useEntryStore((s) => s.entries);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setEntry((await getEntry(id)) ?? null);
      setSummary((await getSummaryByEntryId(id)) ?? null);
      setLoading(false);
    })();
  }, [id]);

  const togglePrivate = async (value: boolean) => {
    if (!entry) return;
    const next = { ...entry, isPrivate: value ? 1 : 0 };
    setEntry(next);
    await updateEntry(entry.id, { isPrivate: next.isPrivate });
  };

  const onDelete = () =>
    Alert.alert('Delete entry?', 'This moves the entry to trash.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!entry) return;
          await softDeleteEntry(entry.id);
          setEntries(entries.filter((e) => e.id !== entry.id));
          router.back();
        },
      },
    ]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }
  if (!entry) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Entry not found.</Text>
      </View>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: 'Entry' }} />

      <View style={styles.headerRow}>
        <Text style={[styles.date, { color: theme.textSecondary }]}>{formatWhen(entry.createdAt)}</Text>
        {entry.moodScore ? (
          <View style={[styles.moodChip, { backgroundColor: MoodColors[entry.moodScore] }]}>
            <Text style={styles.moodEmoji}>{MoodEmoji[entry.moodScore]}</Text>
            <Text style={styles.moodNum}>{entry.moodScore}/5</Text>
          </View>
        ) : null}
      </View>

      <Card style={styles.transcriptCard}>
        {entry.transcript ? (
          <Text style={[styles.transcript, { color: theme.text }]}>{entry.transcript}</Text>
        ) : (
          <Text style={[styles.transcript, styles.transcriptMuted, { color: theme.textSecondary }]}>
            {entry.audioPath
              ? 'Audio saved — transcription didn’t complete for this entry.'
              : 'No transcript.'}
          </Text>
        )}
      </Card>

      {entry.audioPath ? <AudioPlayer audioPath={entry.audioPath} /> : null}

      {summary ? (
        <View style={styles.summaryWrap}>
          <SummaryBlock summary={summary} />
        </View>
      ) : entry.isPrivate ? (
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          This entry is private — AI summaries are disabled for it.
        </Text>
      ) : (
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          No AI summary. Enable AI summaries in Settings to generate one.
        </Text>
      )}

      <Card style={styles.privateRow}>
        <View style={styles.flex}>
          <Text style={[styles.privateLabel, { color: theme.text }]}>Private entry</Text>
          <Text style={[styles.privateHint, { color: theme.textSecondary }]}>
            Excluded from AI analysis and sync.
          </Text>
        </View>
        <Switch value={entry.isPrivate === 1} onValueChange={togglePrivate} />
      </Card>

      <Button label="Delete entry" variant="danger" icon="trash-outline" onPress={onDelete} style={styles.delete} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  date: { fontSize: 14, fontWeight: '500', flex: 1 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  moodEmoji: { fontSize: 14 },
  moodNum: { fontSize: 13, fontWeight: '700', color: '#1A1D23' },
  transcriptCard: { marginBottom: 12 },
  transcript: { fontSize: 17, lineHeight: 26 },
  transcriptMuted: { fontStyle: 'italic' },
  summaryWrap: { marginBottom: 12 },
  note: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  privateLabel: { fontSize: 16, fontWeight: '600' },
  privateHint: { fontSize: 13, marginTop: 2 },
  delete: { marginBottom: 24 },
});
