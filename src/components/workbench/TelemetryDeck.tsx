/**
 * Telemetry deck — right deck of the workbench. This is the differentiator
 * surface: an operational-risk readout (heuristic, NON-CLINICAL), a vector
 * timeline of state over time, and an intervention deck.
 *
 * PLACEHOLDER for now: the shell + aesthetic are real, but the risk engine
 * (per-entry scoring + cross-entry aggregation) is Step 3. It shows a resting
 * "Nominal" baseline and is explicit that live analysis is not yet online, so
 * it never presents a fabricated risk state as fact.
 */
import { StyleSheet, Text, View } from 'react-native';

import { PaneHeader, Panel } from '@/components/workbench/primitives';
import { Fonts, TelemetryColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function TelemetryDeck() {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <PaneHeader title="TELEMETRY" hint="Operational load · heuristic" />

      <Panel label="Current State">
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: TelemetryColors.Nominal }]} />
          <Text style={[styles.status, { color: TelemetryColors.Nominal }]}>NOMINAL</Text>
        </View>
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Baseline. Live scoring comes online with the risk engine.
        </Text>
      </Panel>

      <Panel label="Vector Timeline">
        <View style={[styles.placeholder, { borderColor: theme.border }]}>
          <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>
            Awaiting analysis over 7 / 30-day horizon
          </Text>
        </View>
      </Panel>

      <Panel label="Intervention Deck">
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          No directives. Operational next-steps surface here when a state shift is detected.
        </Text>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { fontFamily: Fonts.mono, fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  note: { fontSize: 12, lineHeight: 17 },
  placeholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 6,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  placeholderText: { fontFamily: Fonts.mono, fontSize: 11, textAlign: 'center' },
});
