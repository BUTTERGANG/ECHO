/**
 * Responsive layout helper. Drives breakpoint-aware layout across web and
 * native from the live window width.
 */
import { useWindowDimensions } from 'react-native';

import { Breakpoints } from '@/constants/theme';

export interface Responsive {
  width: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Suggested column count for card grids. */
  columns: number;
  /** Horizontal screen padding for the active breakpoint. */
  gutter: number;
}

export function useResponsive(): Responsive {
  const { width } = useWindowDimensions();
  const isDesktop = width >= Breakpoints.desktop;
  const isTablet = !isDesktop && width >= Breakpoints.tablet;
  const isPhone = !isTablet && !isDesktop;

  return {
    width,
    isPhone,
    isTablet,
    isDesktop,
    columns: isDesktop ? 3 : isTablet ? 2 : 1,
    gutter: isPhone ? 16 : 24,
  };
}
