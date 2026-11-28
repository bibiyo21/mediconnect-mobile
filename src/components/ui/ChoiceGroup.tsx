import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, size, space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

interface Option<T extends string> {
  value: T;
  label: string;
  /** One line under the label (list variant only), for example the consequence of choosing it. */
  description?: string;
}

interface Props<T extends string> {
  label: string;
  options: readonly Option<T>[];
  /** `null` means nothing is chosen yet. */
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  /**
   * `pills` (default): compact chips that wrap. `list`: stacked rows with a radio dot, for choices where the
   * consequence matters. Selection is shown by the dot, never by a primary fill.
   */
  variant?: 'pills' | 'list';
}

/** IDs for ARIA references must not contain spaces (an ID list is space separated). */
const domId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '-');

/** Single choice from a few options (a labelled radio group). */
export function ChoiceGroup<T extends string>({ label, options, value, onChange, error, variant = 'pills' }: Props<T>) {
  const styles = useThemedStyles(createStyles);
  const isList = variant === 'list';
  const groupId = `${domId(label)}-group`;
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label} nativeID={groupId}>
        {label}
      </Text>
      <View role="radiogroup" aria-labelledby={groupId} style={isList ? styles.stack : styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          if (isList) {
            // The description is referenced by aria-describedby: on web a screen reader then reads the consequence too.
            const descriptionId = option.description ? `${groupId}-${domId(option.value)}-desc` : undefined;
            return (
              <Pressable
                key={option.value}
                role="radio"
                accessibilityLabel={option.label}
                accessibilityHint={option.description}
                aria-describedby={descriptionId}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() => onChange(option.value)}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
              >
                <View style={[styles.dot, selected && styles.dotSelected]}>{selected ? <View style={styles.dotInner} /> : null}</View>
                <View style={styles.rowText}>
                  <Text style={styles.optionText}>{option.label}</Text>
                  {option.description ? (
                    <Text style={styles.description} nativeID={descriptionId}>
                      {option.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }
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

const DOT = size.touchTarget / 2;

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
    stack: { gap: space[2] },
    row: {
      minHeight: size.control,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      padding: space[3],
      borderRadius: radius.md,
      borderWidth: size.hairline,
      borderColor: c.borderStrong,
      backgroundColor: c.surface,
    },
    rowSelected: { borderColor: c.primary, borderWidth: size.focusRingWidth },
    pressed: { opacity: 0.8 },
    dot: {
      width: DOT,
      height: DOT,
      borderRadius: DOT / 2,
      borderWidth: size.focusRingWidth,
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotSelected: { borderColor: c.primary },
    dotInner: { width: DOT / 2, height: DOT / 2, borderRadius: DOT / 4, backgroundColor: c.primary },
    rowText: { flex: 1, gap: space[1] },
    description: { ...typography.small, color: c.textMuted },
    error: { ...typography.small, color: c.error },
  });
