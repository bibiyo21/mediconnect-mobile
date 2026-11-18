import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';

export function OfflineBanner() {
  const { isConnected } = useNetworkState();
  if (isConnected !== false) return null;
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite" role="status">
      <Text style={styles.text}>You are offline. Some information may be out of date.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.warningSurface, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  text: { ...typography.small, color: colors.warning, textAlign: 'center' },
});
