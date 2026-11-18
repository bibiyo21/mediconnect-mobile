import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Notice, Screen } from '@/components/ui';
import { formatManilaDate } from '@/lib/dates';
import { useSession } from '@/features/session/SessionProvider';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

export default function Welcome() {
  const styles = useThemedStyles(createStyles);
  const { signOutReason, signOutDetail } = useSession();
  return (
    <Screen topInset>
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.brand}>
          MediConnect
        </Text>
        <Text style={styles.tagline}>Find doctors, book consultations and keep your care in one place.</Text>
      </View>
      {signOutReason === 'expired' ? <Notice tone="warning" message="Your session ended. Please sign in again." /> : null}
      {signOutReason === 'deletionRequested' ? (
        <Notice tone="info" message={`Your account is scheduled for deletion${signOutDetail ? ` on ${formatManilaDate(signOutDetail)}` : ''}. To keep it, sign in before then.`} />
      ) : null}
      <View style={styles.actions}>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
        <Button label="Create an account" variant="secondary" onPress={() => router.push('/register/contact')} />
      </View>
      <Text style={styles.disclaimer}>MediConnect does not provide emergency care. In an emergency, call 911 or go to the nearest emergency room.</Text>
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    hero: { flex: 1, justifyContent: 'center', gap: space[2], paddingVertical: space[8] },
    brand: { ...typography.display, color: c.primary },
    tagline: { ...typography.body, color: c.textMuted },
    actions: { gap: space[2] },
    disclaimer: { ...typography.small, color: c.textMuted, textAlign: 'center' },
  });
