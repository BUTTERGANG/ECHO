/**
 * Shared "tactile precision" primitives for the workbench decks: mono pane
 * headers, hairline-bordered panels, and mono metric readouts. Kept
 * deliberately stark — 1px borders, no shadows, monospace for all computed
 * values — so the decks read as a telemetry surface, not a SaaS card stack.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, Hairline } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Big mono uppercase pane title, e.g. "STATE" / "TELEMETRY". */
export function PaneHeader({ title, hint }: { title: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.paneHeader}>
      <Text style={[styles.paneTitle, { color: theme.text }]}>{title}</Text>
      {hint ? <Text style={[styles.paneHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

/** Hairline-bordered content block with a small mono uppercase label. */
export function Panel({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { borderColor: theme.border }]}>
      <Text style={[styles.panelLabel, { color: theme.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

/** A single mono metric readout: small label above a large mono value. */
export function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: tone ?? theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  paneHeader: { gap: 2 },
  paneTitle: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700', letterSpacing: 3 },
  paneHint: { fontSize: 12, lineHeight: 16 },
  panel: { borderWidth: Hairline, borderRadius: 6, padding: 14, gap: 12 },
  panelLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  metric: { gap: 3 },
  metricLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  metricValue: { fontFamily: Fonts.mono, fontSize: 22, fontWeight: '700' },
});
