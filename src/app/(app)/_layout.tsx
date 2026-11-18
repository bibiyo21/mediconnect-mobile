import { Stack } from 'expo-router';
import { useNavigationTheme, useTheme } from '@/theme/useTheme';

export default function AppLayout() {
  const { colors } = useTheme();
  const nav = useNavigationTheme(colors);
  return (
    <Stack screenOptions={{ ...nav.stack, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="devices" options={{ title: 'Signed-in devices' }} />
    </Stack>
  );
}
