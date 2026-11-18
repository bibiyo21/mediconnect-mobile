import { Tabs } from 'expo-router/tabs';
import { Text, type ColorValue } from 'react-native';
import { colors } from '@/theme/tokens';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return (
      <Text style={{ color, fontSize: 20 }} aria-hidden accessibilityElementsHidden importantForAccessibility="no">
        {glyph}
      </Text>
    );
  };

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, headerTintColor: colors.text, sceneStyle: { backgroundColor: colors.background } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('☺') }} />
    </Tabs>
  );
}
