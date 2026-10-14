import '@/global.css';

import { Platform } from 'react-native';

// Shared colors for tabs and reusable themed components.
// Individual screens will gradually adopt these same tokens.
export const Colors = {
  light: {
    text: '#222A22',
    background: '#F7F4ED',
    backgroundElement: '#ECEFE8',
    backgroundSelected: '#DDE8D9',
    textSecondary: '#526457',
  },
  dark: {
    text: '#F7F4EE',
    background: '#171B18',
    backgroundElement: '#252D27',
    backgroundSelected: '#344B3C',
    textSecondary: '#C3CBC1',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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
