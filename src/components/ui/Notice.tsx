import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const tones = {
  error: { bg: colors.dangerSurface, fg: colors.danger },
  warning: { bg: colors.warningSurface, fg: colors.warning },
  success: { bg: colors.successSurface, fg: colors.success },
  info: { bg: colors.surface, fg: colors.text },
} as const;

/** Inline message; errors are announced to screen readers. */
export function Notice({ tone = 'info', message }: { tone?: keyof typeof tones; message: string }) {
  const t = tones[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg, borderColor: t.fg }]} role={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite">
      <Text style={[styles.text, { color: t.fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  text: { ...typography.body },
});
