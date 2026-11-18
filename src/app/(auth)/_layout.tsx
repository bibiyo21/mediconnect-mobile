import { Stack } from 'expo-router';
import { RegistrationDraftProvider } from '@/features/auth/RegistrationDraft';
import { colors } from '@/theme/tokens';

export default function AuthLayout() {
  return (
    <RegistrationDraftProvider>
      <Stack screenOptions={{ headerTintColor: colors.primary, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
        <Stack.Screen name="mfa" options={{ title: 'Two-step verification' }} />
        <Stack.Screen name="register/contact" options={{ title: 'Create account' }} />
        <Stack.Screen name="register/verify" options={{ title: 'Verify' }} />
        <Stack.Screen name="register/details" options={{ title: 'Your details' }} />
      </Stack>
    </RegistrationDraftProvider>
  );
}
