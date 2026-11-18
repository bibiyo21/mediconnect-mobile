import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

export function OfflineBanner() {
  const { isConnected } = useNetworkState();
  const styles = useThemedStyles(createStyles);
  if (isConnected !== false) return null;
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite" role="status">
      <Text style={styles.text}>You are offline. Some information may be out of date.</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    banner: { backgroundColor: c.warningSoft, paddingVertical: space[2], paddingHorizontal: space[4] },
    text: { ...typography.small, color: c.warning, textAlign: 'center' },
  });
