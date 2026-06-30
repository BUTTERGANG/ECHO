import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { MoodColors, MoodEmoji } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Entry } from '@/db/schema';

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(ms?: number | null): string | null {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Entry summary card in the feed (handoff §8 Step 4). */
export function EntryCard({ entry }: { entry: Entry }) {
  const theme = useTheme();
  const router = useRouter();
  const preview = (entry.transcript ?? '').trim() || 'No transcript';
  const duration = formatDuration(entry.durationMs);

  return (
    <Card onPress={() => router.push(`/entry/${entry.id}`)} style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.when, { color: theme.textSecondary }]}>{formatWhen(entry.createdAt)}</Text>
        <View style={styles.headerRight}>
          {entry.moodScore ? (
            <View style={[styles.moodDot, { backgroundColor: MoodColors[entry.moodScore] }]}>
              <Text style={styles.moodEmoji}>{MoodEmoji[entry.moodScore]}</Text>
            </View>
          ) : null}
          {entry.isPrivate ? <Ionicons name="lock-closed" size={14} color={theme.textSecondary} /> : null}
        </View>
      </View>
      <Text numberOfLines={3} style={[styles.preview, { color: theme.text }]}>
        {preview}
      </Text>
      <View style={styles.footer}>
        {duration ? (
          <View style={styles.meta}>
            <Ionicons name="mic-outline" size={13} color={theme.textSecondary} />
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>{duration}</Text>
          </View>
        ) : (
          <View style={styles.meta}>
            <Ionicons name="create-outline" size={13} color={theme.textSecondary} />
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>Text</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  when: { fontSize: 13, fontWeight: '500' },
  moodDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moodEmoji: { fontSize: 13 },
  preview: { fontSize: 15, lineHeight: 22 },
  footer: { flexDirection: 'row', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '500' },
});
