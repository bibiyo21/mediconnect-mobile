import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, size, space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  accessibilityLabel: string;
  error?: string;
}

export function Checkbox({ checked, onChange, label, accessibilityLabel, error }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.wrapper}>
      <Pressable
        role="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked }}
        // Explicit for the web build: an unchecked box must still expose aria-checked="false".
        aria-checked={checked}
        onPress={() => onChange(!checked)}
        style={styles.row}
      >
        <View style={[styles.box, checked && styles.boxChecked, error ? styles.boxError : null]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
        <View style={styles.label}>{typeof label === 'string' ? <Text style={styles.text}>{label}</Text> : label}</View>
      </Pressable>
      {error ? (
        <Text style={styles.error} role="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrapper: { gap: space[1] },
    row: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: size.control },
    box: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' },
    boxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    boxError: { borderColor: c.error },
    tick: { color: c.primaryForeground, fontWeight: '700' },
    label: { flex: 1 },
    text: { ...typography.body, color: c.textPrimary },
    error: { ...typography.small, color: c.error },
  });
