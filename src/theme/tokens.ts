/**
 * Design tokens for the patient app. Move to @mediconnect/design-system once
 * a second app needs them.
 */
export const colors = {
  background: '#F5F7F9',
  surface: '#FFFFFF',
  text: '#12212E',
  muted: '#51606D',
  primary: '#0B6E6E',
  primaryText: '#FFFFFF',
  border: '#D9E1E7',
  danger: '#A4262C',
  dangerSurface: '#FBEAEA',
  warning: '#7A5B00',
  warningSurface: '#FFF6D6',
  success: '#1F6B3A',
  successSurface: '#E7F5EC',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16 } as const;

export const typography = {
  title: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  heading: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
} as const;

/** Minimum touch target (iOS HIG / Android: 44–48 pt). */
export const touchTarget = 48;
