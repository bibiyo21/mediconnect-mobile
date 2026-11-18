import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { space, typography } from '@/theme/tokens';
import { useTheme, useThemedStyles, type ThemeColors } from '@/theme/useTheme';
import { Button } from './Button';

type Props =
  | { state: 'loading'; message?: string }
  | { state: 'empty'; message: string }
  | { state: 'error'; message: string; onRetry?: () => void };

/** Shared loading / empty / error presentation. */
export function StateView(props: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      {props.state === 'loading' ? <ActivityIndicator color={colors.primary} accessibilityLabel={props.message ?? 'Loading'} /> : null}
      {props.message ? <Text style={[styles.text, props.state === 'error' && styles.error]}>{props.message}</Text> : null}
      {props.state === 'error' && props.onRetry ? <Button label="Try again" variant="secondary" onPress={props.onRetry} /> : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    box: { padding: space[6], gap: space[4], alignItems: 'center' },
    text: { ...typography.body, color: c.textMuted, textAlign: 'center' },
    error: { color: c.error },
  });
