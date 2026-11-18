import { Stack } from 'expo-router';
import { RegistrationDraftProvider } from '@/features/auth/RegistrationDraft';
import { useNavigationTheme, useTheme } from '@/theme/useTheme';

export default function AuthLayout() {
  const { colors } = useTheme();
  const nav = useNavigationTheme(colors);
  return (
    <RegistrationDraftProvider>
      <Stack screenOptions={{ ...nav.stack, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
        <Stack.Screen name="mfa" options={{ title: 'Two-step verification' }} />
        <Stack.Screen name="register/contact" options={{ title: 'Create account' }} />
        <Stack.Screen name="register/verify" options={{ title: 'Verify' }} />
        <Stack.Screen name="register/details" options={{ title: 'Your details' }} />
        <Stack.Screen name="reset-password/index" options={{ title: 'Reset password' }} />
        <Stack.Screen name="reset-password/new" options={{ title: 'Choose a new password' }} />
      </Stack>
    </RegistrationDraftProvider>
  );
}
