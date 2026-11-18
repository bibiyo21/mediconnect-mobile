import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/tokens';

interface Props {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  accessibilityLabel: string;
  error?: string;
}

export function Checkbox({ checked, onChange, label, accessibilityLabel, error }: Props) {
  return (
    <View style={styles.wrapper}>
      <Pressable
        role="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked }}
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

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: touchTarget },
  box: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  tick: { color: colors.primaryText, fontWeight: '700' },
  label: { flex: 1 },
  text: { ...typography.body, color: colors.text },
  error: { ...typography.small, color: colors.danger },
});
