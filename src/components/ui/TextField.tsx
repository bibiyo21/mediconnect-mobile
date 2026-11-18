import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, size, space, typography } from '@/theme/tokens';
import { useTheme, useThemedStyles, type ThemeColors } from '@/theme/useTheme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Labelled input; the error is announced and tied to the field for screen readers.
 * Password fields (`secureTextEntry`) get a Show/Hide control so people can check what they typed.
 */
export function TextField({ label, error, hint, secureTextEntry, ...input }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label} nativeID={`${label}-label`}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        aria-invalid={error ? true : undefined}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, secureTextEntry ? styles.inputWithToggle : null, error ? styles.inputError : null]}
        secureTextEntry={secureTextEntry && !revealed}
        {...input}
      />
      {secureTextEntry ? (
        <Pressable
          role="button"
          accessibilityLabel={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onPress={() => setRevealed((r) => !r)}
          hitSlop={8}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>{revealed ? 'Hide' : 'Show'}</Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" role="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrapper: { gap: space[1] },
    label: { ...typography.label, color: c.textPrimary },
    input: {
      minHeight: size.control,
      borderWidth: size.hairline,
      borderColor: c.borderStrong,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      paddingHorizontal: space[4],
      ...typography.body,
      color: c.textPrimary,
    },
    inputError: { borderColor: c.error },
    inputWithToggle: { paddingRight: space[16] },
    toggle: { position: 'absolute', right: space[2], top: typography.label.lineHeight + space[1], minHeight: size.control, minWidth: size.control, alignItems: 'center', justifyContent: 'center' },
    toggleText: { ...typography.label, color: c.primary },
    error: { ...typography.small, color: c.error },
    hint: { ...typography.small, color: c.textMuted },
  });
