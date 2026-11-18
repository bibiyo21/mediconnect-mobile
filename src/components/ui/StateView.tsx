import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';
import { Button } from './Button';

type Props =
  | { state: 'loading'; message?: string }
  | { state: 'empty'; message: string }
  | { state: 'error'; message: string; onRetry?: () => void };

/** Shared loading / empty / error presentation. */
export function StateView(props: Props) {
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      {props.state === 'loading' ? <ActivityIndicator color={colors.primary} accessibilityLabel={props.message ?? 'Loading'} /> : null}
      {props.message ? <Text style={[styles.text, props.state === 'error' && styles.error]}>{props.message}</Text> : null}
      {props.state === 'error' && props.onRetry ? <Button label="Try again" variant="secondary" onPress={props.onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  text: { ...typography.body, color: colors.muted, textAlign: 'center' },
  error: { color: colors.danger },
});
