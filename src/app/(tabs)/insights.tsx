import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MoodHeatmap } from '@/components/MoodHeatmap';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { generateWeeklyReview, type WeeklyReview } from '@/services/claude';
import { useEntries } from '@/hooks/useEntries';
import { useTheme } from '@/hooks/use-theme';
import { useStreak } from '@/hooks/useStreak';
import { useSettingsStore } from '@/stores/settingsStore';

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <Card style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </Card>
  );
}

export default function InsightsScreen() {
  const theme = useTheme();
  const { entries } = useEntries();
  const streak = useStreak();
  const aiEnabled = useSettingsStore((s) => s.aiSummariesEnabled);

  const [avgMood, setAvgMood] = useState('—');
  const [weekTranscripts, setWeekTranscripts] = useState<string[]>([]);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive mood average + this week's eligible transcripts off the render path.
  useEffect(() => {
    const scored = entries.filter((e) => e.moodScore);
    setAvgMood(
      scored.length === 0
        ? '—'
        : (scored.reduce((s, e) => s + (e.moodScore ?? 0), 0) / scored.length).toFixed(1),
    );
    const cutoff = Date.now() - 7 * 86_400_000;
    setWeekTranscripts(
      entries
        .filter((e) => e.isPrivate !== 1 && (e.transcript ?? '').trim() && e.createdAt >= cutoff)
        .map((e) => (e.transcript ?? '').trim()),
    );
  }, [entries]);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateWeeklyReview(weekTranscripts);
      setReview(result.review);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate your review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: theme.text }]}>Insights</Text>

      <View style={styles.statRow}>
        <Stat label="Entries" value={String(entries.length)} />
        <Stat label="Avg mood" value={avgMood} />
        <Stat label="Streak" value={`${streak}d`} />
      </View>

      <SectionHeader title="Mood over time" />
      {entries.some((e) => e.moodScore) ? (
        <Card>
          <MoodHeatmap entries={entries} />
        </Card>
      ) : (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Log your mood on a few entries and your mood map will appear here.
        </Text>
      )}

      <SectionHeader title="Weekly review" />
      {review ? (
        <Card style={styles.reviewCard}>
          <Text style={[styles.reviewSummary, { color: theme.text }]}>{review.summary}</Text>
          {review.topThemes.length > 0 ? (
            <View style={styles.themes}>
              {review.topThemes.map((t) => (
                <View key={t} style={[styles.themeChip, { backgroundColor: theme.accentSoft }]}>
                  <Text style={[styles.themeText, { color: theme.accent }]}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {review.carryForward ? (
            <Text style={[styles.carry, { color: theme.textSecondary }]}>
              Carry forward: {review.carryForward}
            </Text>
          ) : null}
          <Button
            label="Regenerate"
            icon="refresh"
            variant="ghost"
            onPress={onGenerate}
            loading={loading}
            style={styles.reviewBtn}
          />
        </Card>
      ) : !aiEnabled ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Turn on AI summaries in Settings to generate a private, AI-written review of your week.
        </Text>
      ) : weekTranscripts.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Record a few entries this week and you can generate a review of how it went.
        </Text>
      ) : (
        <View>
          <Text style={[styles.empty, { color: theme.textSecondary }]}>
            Summarize your last {weekTranscripts.length}{' '}
            {weekTranscripts.length === 1 ? 'entry' : 'entries'} into a reflective weekly narrative.
          </Text>
          <Button
            label="Generate weekly review"
            icon="sparkles"
            onPress={onGenerate}
            loading={loading}
            style={styles.reviewBtn}
          />
        </View>
      )}
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 20 },
  statValue: { fontSize: 26, fontWeight: '700' },
  statLabel: { fontSize: 13, fontWeight: '500' },
  empty: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  reviewCard: { gap: 12 },
  reviewSummary: { fontSize: 16, lineHeight: 24 },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  themeText: { fontSize: 13, fontWeight: '600' },
  carry: { fontSize: 14, lineHeight: 20 },
  reviewBtn: { alignSelf: 'flex-start', marginTop: 4 },
  error: { fontSize: 14, lineHeight: 20, marginTop: 4 },
});
