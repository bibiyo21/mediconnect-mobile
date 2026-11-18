import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radius, size, space, typography } from '@/theme/tokens';
import { useTheme, useThemedStyles, type ThemeColors } from '@/theme/useTheme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, accessibilityHint }: Props) {
  const inactive = disabled || loading;
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], pressed && variant === 'primary' && styles.primaryPressed, inactive && styles.inactive, pressed && variant !== 'primary' && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.primaryForeground : colors.primary} />
      ) : (
        <Text style={[styles.label, variant === 'primary' ? styles.primaryLabel : variant === 'danger' ? styles.dangerLabel : styles.secondaryLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    base: { minHeight: size.control, borderRadius: radius.md, paddingHorizontal: space[4], alignItems: 'center', justifyContent: 'center' },
    primary: { backgroundColor: c.primary },
    primaryPressed: { backgroundColor: c.primaryHover },
    secondary: { backgroundColor: c.surface, borderWidth: size.hairline, borderColor: c.borderStrong },
    danger: { backgroundColor: c.surface, borderWidth: size.hairline, borderColor: c.error },
    inactive: { opacity: 0.55 },
    pressed: { opacity: 0.8 },
    label: { ...typography.label },
    primaryLabel: { color: c.primaryForeground },
    secondaryLabel: { color: c.primary },
    dangerLabel: { color: c.error },
  });
