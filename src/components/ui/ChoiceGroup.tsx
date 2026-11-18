import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, size, space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
}

/** Single choice from a few options (a labelled radio group); wraps on narrow screens. */
export function ChoiceGroup<T extends string>({ label, options, value, onChange, error }: Props<T>) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label} nativeID={`${label}-group`}>
        {label}
      </Text>
      <View role="radiogroup" aria-labelledby={`${label}-group`} style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              role="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              onPress={() => onChange(option.value)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
    label: { ...typography.label, color: c.textPrimary },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
    option: {
      minHeight: size.control,
      paddingHorizontal: space[4],
      borderRadius: radius.md,
      borderWidth: size.hairline,
      borderColor: c.borderStrong,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionSelected: { backgroundColor: c.primary, borderColor: c.primary },
    optionText: { ...typography.label, color: c.textPrimary },
    optionTextSelected: { color: c.primaryForeground },
    error: { ...typography.small, color: c.error },
  });
