/**
 * React Native adapter for @mediconnect/design-system (docs/design-system.md).
 * Values live in the shared package; this file only reshapes them for StyleSheet.
 * Colours are per colour scheme: read them through `useTheme()` / `useThemedStyles()` (./useTheme).
 */
import { breakpoints, motion, radius, shadow, size, space, typography as shared, zIndex, type ColorScheme, type TypographyToken } from '@mediconnect/design-system';

export { breakpoints, motion, radius, size, space, zIndex };
export type { ColorScheme };

type FontWeight = '400' | '600' | '700';

/** Spread into a text style: `{ ...typography.body, color }`. Letter spacing is converted from em to dp. */
export const typography = Object.fromEntries(
  (Object.entries(shared) as [TypographyToken, (typeof shared)[TypographyToken]][]).map(([name, t]) => [
    name,
    {
      fontSize: t.fontSize,
      lineHeight: t.lineHeight,
      fontWeight: String(t.fontWeight) as FontWeight,
      letterSpacing: Math.round(t.letterSpacing * t.fontSize * 100) / 100,
    },
  ]),
) as Record<TypographyToken, { fontSize: number; lineHeight: number; fontWeight: FontWeight; letterSpacing: number }>;

/** Overlay shadow for dialogs, menus and popovers. Dark mode relies on `surfaceElevated` instead. */
export function overlayShadow(scheme: ColorScheme): { boxShadow?: string } {
  const s = shadow.overlay[scheme];
  return s ? { boxShadow: `${s.x}px ${s.y}px ${s.blur}px ${s.color}` } : {};
}
