import type { ExpoConfig } from 'expo/config';

/**
 * Environment-aware Expo config. APP_VARIANT is set by the EAS build profile
 * (eas.json): development | preview | production.
 *
 * Only public values belong here: anything in the app bundle can be read by
 * users. No API keys or secrets.
 */
const variant = (process.env.APP_VARIANT ?? 'development') as 'development' | 'preview' | 'production';

// D-34 (pending approval): permanent once uploaded to App Store Connect / Google Play.
const BUNDLE_ID = 'ph.mediconnect.app';

const suffix = variant === 'production' ? '' : `.${variant}`;
const name = variant === 'production' ? 'MediConnect' : `MediConnect (${variant})`;

const config: ExpoConfig = {
  name,
  slug: 'mediconnect',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'mediconnect',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: `${BUNDLE_ID}${suffix}`,
    supportsTablet: false,
    icon: './assets/expo.icon',
    infoPlist: {
      // Standard HTTPS only (export compliance); confirm with counsel before release.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: `${BUNDLE_ID}${suffix}`,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    // Single-page build: the web build signs in with the Sanctum session cookie (D-04).
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#0B6E6E', image: './assets/images/splash-icon.png', imageWidth: 76 }],
    'expo-secure-store',
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { variant },
};

export default config;
