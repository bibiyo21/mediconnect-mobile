import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/queryClient';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import { useTheme, useNavigationTheme } from '@/theme/useTheme';

// Keep the splash screen up while the stored session is restored.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { colors } = useTheme();
  const nav = useNavigationTheme(colors);
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'restoring') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  if (status === 'restoring') return null;

  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: nav.stack.contentStyle }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
