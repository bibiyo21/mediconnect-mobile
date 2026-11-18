import { Pressable, StyleSheet, Text } from 'react-native';
import { size, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** A low-emphasis text action ("Forgot your password?") with a full-size touch target. */
export function LinkButton({ label, onPress, accessibilityHint }: { label: string; onPress: () => void; accessibilityHint?: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable role="link" accessibilityLabel={label} accessibilityHint={accessibilityHint} onPress={onPress} style={styles.target}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    target: { minHeight: size.touchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
    text: { ...typography.label, color: c.primary, textDecorationLine: 'underline' },
  });
