import * as SecureStore from 'expo-secure-store';

/**
 * Refresh token storage: iOS Keychain / Android Keystore via SecureStore.
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY keeps it out of backups and device transfers.
 * The short-lived access token is never persisted; it lives in memory.
 */
const KEY = 'mediconnect.session.v1';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export interface StoredSession {
  refreshToken: string;
  deviceId: string;
}

export const tokenStore = {
  async load(): Promise<StoredSession | null> {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      return parsed.refreshToken && parsed.deviceId ? { refreshToken: parsed.refreshToken, deviceId: parsed.deviceId } : null;
    } catch {
      await SecureStore.deleteItemAsync(KEY, OPTIONS);
      return null;
    }
  },
  save(session: StoredSession): Promise<void> {
    return SecureStore.setItemAsync(KEY, JSON.stringify(session), OPTIONS);
  },
  clear(): Promise<void> {
    return SecureStore.deleteItemAsync(KEY, OPTIONS);
  },
};
