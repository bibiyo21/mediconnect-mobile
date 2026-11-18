import { Stack } from 'expo-router';
import { useNavigationTheme, useTheme } from '@/theme/useTheme';

export default function AppLayout() {
  const { colors } = useTheme();
  const nav = useNavigationTheme(colors);
  return (
    <Stack screenOptions={{ ...nav.stack, headerBackButtonDisplayMode: 'minimal' }}>
      {/* The title names the back link on pushed screens ("MediConnect, back"), not the route group. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'MediConnect' }} />
      <Stack.Screen name="devices" options={{ title: 'Signed-in devices' }} />
      <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
      <Stack.Screen name="contact" options={{ title: 'Contact details' }} />
      <Stack.Screen name="family/index" options={{ title: 'Family members' }} />
      <Stack.Screen name="family/new" options={{ title: 'Add a family member' }} />
      <Stack.Screen name="family/[id]" options={{ title: 'Family member' }} />
    </Stack>
  );
}
