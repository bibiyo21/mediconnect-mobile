import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="devices" options={{ title: 'Signed-in devices' }} />
    </Stack>
  );
}
