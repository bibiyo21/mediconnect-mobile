import { createRealtime, type RealtimeClient } from '@mediconnect/api-client/realtime';
import { session } from './api';
import { API_URL, REALTIME } from './config';

/**
 * A new realtime client for the signed-in user, or null when Reverb is not
 * configured. A client cannot be reused after disconnect, so the provider
 * creates one per signed-in session and disconnects it on cleanup.
 * Web uses the Sanctum cookie plus CSRF; native sends the in-memory bearer token.
 */
export function createAppRealtime(options: { onSubscriptionError?: (channel: string, status: number) => void } = {}): RealtimeClient | null {
  if (!REALTIME.appKey || !REALTIME.host) return null;
  return createRealtime({
    appKey: REALTIME.appKey,
    wsHost: REALTIME.host,
    wsPort: REALTIME.port,
    scheme: REALTIME.scheme,
    authEndpoint: `${API_URL}/broadcasting/auth`,
    onSubscriptionError: options.onSubscriptionError,
    auth:
      session.mode === 'cookie'
        ? { mode: 'cookie', csrf: true }
        : { mode: 'bearer', getToken: () => session.currentAccessToken() },
  });
}
