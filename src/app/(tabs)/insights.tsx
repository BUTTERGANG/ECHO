import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Radii } from '@/constants/theme';
import { useEntries } from '@/hooks/useEntries';
import { useResponsive } from '@/hooks/useResponsive';
import { useStreak } from '@/hooks/useStreak';
import { useTheme } from '@/hooks/use-theme';

const COMING_SOON: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  { icon: 'git-network-outline', title: 'Pattern engine', desc: 'Recurring themes, people, and places surfaced across your entries.' },
  { icon: 'calendar-outline', title: 'Mood heatmap', desc: 'A year of your mood at a glance, colored day by day.' },
  { icon: 'newspaper-outline', title: 'Weekly review', desc: 'An AI-written narrative of your week, every Monday.' },
];

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
  const { isPhone } = useResponsive();

  const avgMood = useMemo(() => {
    const scored = entries.filter((e) => e.moodScore);
    if (scored.length === 0) return '—';
    return (scored.reduce((sum, e) => sum + (e.moodScore ?? 0), 0) / scored.length).toFixed(1);
  }, [entries]);

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: theme.text }]}>Insights</Text>

      <View style={[styles.statRow, isPhone && styles.statRowPhone]}>
        <Stat label="Entries" value={String(entries.length)} />
        <Stat label="Avg mood" value={avgMood} />
        <Stat label="Streak" value={`${streak}d`} />
      </View>

      <SectionHeader title="Coming in Phase 2" />
      <View style={styles.soonList}>
        {COMING_SOON.map((item) => (
          <Card key={item.title} style={styles.soonCard}>
            <View style={[styles.soonIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name={item.icon} size={20} color={theme.accent} />
            </View>
            <View style={styles.soonText}>
              <View style={styles.soonHeader}>
                <Text style={[styles.soonTitle, { color: theme.text }]}>{item.title}</Text>
                <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.badgeText, { color: theme.textSecondary }]}>Soon</Text>
                </View>
              </View>
              <Text style={[styles.soonDesc, { color: theme.textSecondary }]}>{item.desc}</Text>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 12 },
  statRowPhone: {},
  stat: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 20 },
  statValue: { fontSize: 26, fontWeight: '700' },
  statLabel: { fontSize: 13, fontWeight: '500' },
  soonList: { gap: 12 },
  soonCard: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  soonIcon: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  soonText: { flex: 1, gap: 4 },
  soonHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soonTitle: { fontSize: 16, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.pill },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  soonDesc: { fontSize: 14, lineHeight: 20 },
});
