/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    // ECHO semantic tokens
    card: '#FFFFFF',
    border: '#E6E8EC',
    // Darkened from #4F7CFF so white-on-accent and accent-colored text meet WCAG AA.
    accent: '#3A63E8',
    accentText: '#FFFFFF',
    accentSoft: '#EAF0FF',
    danger: '#E5484D',
    success: '#46A758',
    warning: '#F2A33C',
    overlay: 'rgba(17,20,28,0.45)',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    // ECHO semantic tokens
    card: '#161719',
    border: '#2A2C30',
    accent: '#6E8BFF',
    accentText: '#0B0D12',
    accentSoft: '#1B2030',
    danger: '#F2555A',
    success: '#5BB372',
    warning: '#F5B95A',
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

/** Mood score (1–5) → color, shared light/dark. */
export const MoodColors = ['#9AA0A6', '#E5675F', '#E8A04D', '#E6C84F', '#8FBF63', '#5BB372'] as const;
export const MoodEmoji = ['', '😞', '😕', '😐', '🙂', '😄'] as const;

/** Energy level (1–3 = low/medium/high). Index 0 is an unused placeholder so
 * the arrays are addressable by the stored 1-based level, like MoodColors. */
export const EnergyLabels = ['', 'Low', 'Medium', 'High'] as const;
export const EnergyColors = ['#9AA0A6', '#7C9CF6', '#E8A04D', '#5BB372'] as const;
export const EnergyIcons = ['', 'battery-dead-outline', 'battery-half-outline', 'battery-full-outline'] as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Width breakpoints (px). */
export const Breakpoints = {
  tablet: 600,
  desktop: 1024,
} as const;

/**
 * Time-of-day accent tints. Applied as a very-low-opacity wash behind screen
 * content (see Screen.tsx / useTimeOfDay), so the app subtly warms in the
 * morning, cools through the afternoon, and settles into evening/night.
 */
export const TimeOfDayTints = {
  morning: '#F5A623', // warm amber
  afternoon: '#4F7CFF', // clear blue
  evening: '#E8743B', // sunset orange
  night: '#3B4CCA', // deep indigo
} as const;
export type TimeOfDay = keyof typeof TimeOfDayTints;

/**
 * Operational telemetry statuses for the workbench Risk deck. These are
 * heuristic, NON-CLINICAL system-state indicators (cognitive load / velocity),
 * deliberately worded like telemetry rather than psychological labels. Ordered
 * low → high concern.
 */
export const TelemetryStatuses = ['Nominal', 'Guarded', 'Degraded', 'Overextended', 'Critical'] as const;
export type TelemetryStatus = (typeof TelemetryStatuses)[number];
export const TelemetryColors: Record<TelemetryStatus, string> = {
  Nominal: '#5BB372',
  Guarded: '#8FBF63',
  Degraded: '#E8A04D',
  Overextended: '#E5675F',
  Critical: '#E5484D',
};

/** Hairline divider width for the analytical workbench (stark 1px, no shadows). */
export const Hairline = 1;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
