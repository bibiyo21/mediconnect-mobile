import { Tabs } from 'expo-router/tabs';
import type { ColorValue } from 'react-native';
import { BrandIcon, type BrandIconName } from '@/components/ui';
import { useTheme } from '@/theme/useTheme';

const icon = (name: BrandIconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <BrandIcon name={name} size={24} tintColor={color} />;
  };

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border }, headerTintColor: colors.textPrimary, sceneStyle: { backgroundColor: colors.background } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('tab-home') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('tab-account') }} />
    </Tabs>
  );
}
