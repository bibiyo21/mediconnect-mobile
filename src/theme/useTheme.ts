import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors as palettes } from '@mediconnect/design-system';
import type { ColorScheme } from './tokens';

export type ThemeColors = (typeof palettes)[ColorScheme];

/** Follows the OS setting (docs/design-system.md, section 4); there is no manual toggle yet. */
export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme] };
}

/**
 * Builds a StyleSheet for the current colour scheme, memoised per scheme.
 * `const styles = useThemedStyles((c) => StyleSheet.create({ box: { backgroundColor: c.surface } }));`
 * The factory must be a module-level function (stable identity).
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors, scheme: ColorScheme) => T): T {
  const { colors, scheme } = useTheme();
  return useMemo(() => factory(colors, scheme), [factory, colors, scheme]);
}

/** Shared navigator options so headers and tab bars follow the theme. */
export function useNavigationTheme(colors: ThemeColors) {
  return {
    stack: {
      headerTintColor: colors.primary,
      headerStyle: { backgroundColor: colors.surface },
      headerTitleStyle: { color: colors.textPrimary },
      contentStyle: { backgroundColor: colors.background },
      // Screens show their own large title (Screen); the header only carries the back button.
      // `title` stays set per screen for the web document title and screen readers.
      headerTitle: () => null,
      headerShadowVisible: false,
    },
  } as const;
}
