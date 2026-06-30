import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/use-theme';

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView. */
  scroll?: boolean;
  /** Apply horizontal gutter padding (default true). */
  padded?: boolean;
  /** Override the centered max content width. */
  maxWidth?: number;
  contentStyle?: ViewStyle;
  edges?: readonly Edge[];
}

/**
 * Screen container: themed background + a centered, max-width content column
 * so the app reads well on phones and doesn't sprawl on wide web viewports.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  maxWidth = MaxContentWidth,
  contentStyle,
  edges = ['left', 'right'],
}: ScreenProps) {
  const theme = useTheme();
  const { gutter } = useResponsive();

  const inner = (
    <View
      style={[
        styles.column,
        scroll ? styles.columnScroll : styles.columnFill,
        { maxWidth, paddingHorizontal: padded ? gutter : 0 },
        contentStyle,
      ]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.background }]} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {inner}
        </ScrollView>
      ) : (
        <View style={styles.center}>{inner}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center' },
  scrollContent: { alignItems: 'center', flexGrow: 1, paddingVertical: 16 },
  column: { width: '100%' },
  columnFill: { flex: 1 },
  columnScroll: { flexGrow: 1 },
});
