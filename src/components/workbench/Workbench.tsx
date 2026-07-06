/**
 * Desktop analytical workbench (isDesktop only): three fixed panes —
 *   State (left) | Intake/Analysis (center) | Telemetry (right)
 * separated by 1px hairline dividers, no elevations. This is the "command
 * center" surface for reviewing patterns over a horizon.
 *
 * Below desktop width it renders the center only; the side decks are reached
 * as their own sub-views on mobile (see app/state.tsx). Deliberately stark —
 * no time-of-day tint here (that warmth belongs to the mobile capture loop).
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Hairline } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/use-theme';

const SIDE_WIDTH = 320;

interface Props {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}

export function Workbench({ left, center, right }: Props) {
  const { isDesktop } = useResponsive();
  const theme = useTheme();

  // Mobile / tablet: single-column center; decks live as sub-views.
  if (!isDesktop) return <>{center}</>;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.background }]}>
      <View style={styles.row}>
        <View style={[styles.side, { borderRightWidth: Hairline, borderColor: theme.border }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pad}>
            {left}
          </ScrollView>
        </View>

        <View style={styles.center}>{center}</View>

        <View style={[styles.side, { borderLeftWidth: Hairline, borderColor: theme.border }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pad}>
            {right}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  side: { width: SIDE_WIDTH },
  center: { flex: 1, minWidth: 0 },
  pad: { padding: 20, gap: 20 },
});
