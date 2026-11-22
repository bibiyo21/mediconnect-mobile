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
      <Stack.Screen name="delete-account" options={{ title: 'Delete your account' }} />
      <Stack.Screen name="doctor/index" options={{ title: 'Doctor profile' }} />
      <Stack.Screen name="doctor/start" options={{ title: 'Register as a doctor' }} />
      <Stack.Screen name="doctor/edit" options={{ title: 'Edit doctor profile' }} />
      <Stack.Screen name="doctor/clinics" options={{ title: 'Your clinics' }} />
      <Stack.Screen name="doctor/services" options={{ title: 'Services and fees' }} />
      <Stack.Screen name="doctor/schedule" options={{ title: 'Weekly schedule' }} />
      <Stack.Screen name="doctor/schedule-edit" options={{ title: 'Schedule' }} />
      <Stack.Screen name="doctor/time-off" options={{ title: 'Time off and extra hours' }} />
      <Stack.Screen name="search" options={{ title: 'Find a doctor' }} />
      <Stack.Screen name="directory/index" options={{ title: 'Doctors' }} />
      <Stack.Screen name="directory/doctor/[id]" options={{ title: 'Doctor' }} />
      <Stack.Screen name="directory/clinic/[id]" options={{ title: 'Clinic' }} />
    </Stack>
  );
}
