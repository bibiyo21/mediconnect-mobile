import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Notice, Screen } from '@/components/ui';
import { useSession } from '@/features/session/SessionProvider';
import { colors, spacing, typography } from '@/theme/tokens';

export default function Welcome() {
  const { signOutReason } = useSession();
  return (
    <Screen topInset>
      <View style={styles.hero}>
        <Text accessibilityRole="header" style={styles.brand}>
          MediConnect
        </Text>
        <Text style={styles.tagline}>Find doctors, book consultations and keep your care in one place.</Text>
      </View>
      {signOutReason === 'expired' ? <Notice tone="warning" message="Your session ended. Please sign in again." /> : null}
      <View style={styles.actions}>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
        <Button label="Create an account" variant="secondary" onPress={() => router.push('/register/contact')} />
      </View>
      <Text style={styles.disclaimer}>MediConnect does not provide emergency care. In an emergency, call 911 or go to the nearest emergency room.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  brand: { ...typography.title, fontSize: 34, lineHeight: 40, color: colors.primary },
  tagline: { ...typography.body, color: colors.muted },
  actions: { gap: spacing.sm },
  disclaimer: { ...typography.small, color: colors.muted, textAlign: 'center' },
});
