import { StyleSheet, Text, View } from 'react-native';
import { radius, size, space, typography } from '@/theme/tokens';
import { useThemedStyles, useTheme, type ThemeColors } from '@/theme/useTheme';

type Tone = 'error' | 'warning' | 'success' | 'info';

function tones(c: ThemeColors): Record<Tone, { bg: string; fg: string }> {
  return {
    error: { bg: c.errorSoft, fg: c.error },
    warning: { bg: c.warningSoft, fg: c.warning },
    success: { bg: c.successSoft, fg: c.success },
    info: { bg: c.infoSoft, fg: c.info },
  };
}

/** Inline message; errors are announced to screen readers. */
export function Notice({ tone = 'info', message }: { tone?: Tone; message: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const t = tones(colors)[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg, borderColor: t.fg }]} role={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite">
      <Text style={[styles.text, { color: t.fg }]}>{message}</Text>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  box: { borderWidth: size.hairline, borderRadius: radius.md, padding: space[4] },
  text: { ...typography.body },
});
