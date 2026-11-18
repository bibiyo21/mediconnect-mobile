import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, size, space, typography } from '@/theme/tokens';
import { useTheme, useThemedStyles, type ThemeColors } from '@/theme/useTheme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
}

/** Labelled input; the error is announced and tied to the field for screen readers. */
export function TextField({ label, error, hint, ...input }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
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
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
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
    error: { ...typography.small, color: c.error },
    hint: { ...typography.small, color: c.textMuted },
  });
