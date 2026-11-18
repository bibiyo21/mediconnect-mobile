import { Tabs } from 'expo-router/tabs';
import { Text, type ColorValue } from 'react-native';
import { useTheme } from '@/theme/useTheme';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return (
      <Text style={{ color, fontSize: 20 }} aria-hidden accessibilityElementsHidden importantForAccessibility="no">
        {glyph}
      </Text>
    );
  };

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border }, headerTintColor: colors.textPrimary, sceneStyle: { backgroundColor: colors.background } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('☺') }} />
    </Tabs>
  );
}
