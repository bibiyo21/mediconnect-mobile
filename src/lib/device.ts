import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** Device description sent at sign-in (shown in "Signed-in devices"). */
export function deviceInfo(): { platform: 'IOS' | 'ANDROID'; name: string } | undefined {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return undefined;
  return { platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', name: (Device.modelName ?? 'Phone').slice(0, 100) };
}
