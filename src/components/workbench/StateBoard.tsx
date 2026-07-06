/**
 * State Board — left deck of the workbench. Establishes context before a word
 * is typed: precise age (a live mono counter), days since the last user-marked
 * pivot, and the historical mood baseline. Demographic anchors come from
 * profileStore; the baseline reuses MoodHeatmap.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MoodHeatmap } from '@/components/MoodHeatmap';
import { Metric, PaneHeader, Panel } from '@/components/workbench/primitives';
import { Fonts, Hairline } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useEntryStore } from '@/stores/entryStore';
import { useProfileStore } from '@/stores/profileStore';
import { daysSince, preciseAgeYears } from '@/utils/dateHelpers';

/** Live precise-age readout: big rounded value + a mono sub-line that ticks. */
function AgeTicker({ dobMs }: { dobMs: number }) {
  const theme = useTheme();
  const [now, setNow] = useState(() => dobMs); // placeholder; real value set in effect

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const years = preciseAgeYears(dobMs, now);
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>PRECISE AGE</Text>
      <Text style={[styles.metricValue, { color: theme.text }]}>{years.toFixed(1)} yrs</Text>
      <Text style={[styles.tick, { color: theme.textSecondary }]}>{years.toFixed(8)}</Text>
    </View>
  );
}

function MiniButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.miniBtn, { borderColor: theme.border }]}>
      <Text style={[styles.miniBtnText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

/** Parse a 'YYYY-MM-DD' string to a past epoch-ms, or null if invalid. */
function parseDob(input: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) return null;
  const ms = new Date(`${input.trim()}T00:00:00`).getTime();
  if (Number.isNaN(ms) || ms > Date.now()) return null;
  return ms;
}

export function StateBoard() {
  const theme = useTheme();
  const entries = useEntryStore((s) => s.entries);
  const { dateOfBirth, lastPivotAt, setDateOfBirth, markPivot } = useProfileStore();

  // Read the clock in an effect (not during render) for the day-granularity metrics.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const [dobInput, setDobInput] = useState('');
  const [dobError, setDobError] = useState(false);

  const onSetDob = () => {
    const ms = parseDob(dobInput);
    if (ms === null) {
      setDobError(true);
      return;
    }
    setDobError(false);
    setDobInput('');
    setDateOfBirth(ms);
  };

  const pivotDays = lastPivotAt !== null && nowMs !== null ? String(daysSince(lastPivotAt, nowMs)) : '—';

  return (
    <View style={styles.wrap}>
      <PaneHeader title="STATE" hint="Baseline context" />

      <Panel label="Demographic Hub">
        {dateOfBirth !== null ? (
          <>
            <AgeTicker dobMs={dateOfBirth} />
            <MiniButton label="Edit DOB" onPress={() => setDateOfBirth(null)} />
          </>
        ) : (
          <View style={styles.dobSetter}>
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>SET DATE OF BIRTH</Text>
            <TextInput
              value={dobInput}
              onChangeText={setDobInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              onSubmitEditing={onSetDob}
              style={[styles.dobInput, { color: theme.text, borderColor: theme.border }]}
            />
            {dobError ? (
              <Text style={[styles.error, { color: theme.danger }]}>Enter a past date as YYYY-MM-DD.</Text>
            ) : null}
            <MiniButton label="Set" onPress={onSetDob} />
          </View>
        )}
      </Panel>

      <Panel label="Last Pivot">
        <Metric label="Days since last pivot" value={pivotDays} />
        <MiniButton label="Mark pivot now" onPress={() => markPivot()} />
      </Panel>

      <Panel label="Historical Baseline">
        <MoodHeatmap entries={entries} />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  metric: { gap: 3 },
  metricLabel: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  metricValue: { fontFamily: Fonts.mono, fontSize: 22, fontWeight: '700' },
  tick: { fontFamily: Fonts.mono, fontSize: 12 },
  dobSetter: { gap: 8 },
  dobInput: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    borderWidth: Hairline,
    borderRadius: 4,
    paddingHorizontal: 10,
    height: 38,
  },
  error: { fontSize: 12, lineHeight: 16 },
  miniBtn: {
    alignSelf: 'flex-start',
    borderWidth: Hairline,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  miniBtnText: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
});
