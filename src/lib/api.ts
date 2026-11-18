import { createApiClient, ensureCsrfCookie } from '@mediconnect/api-client';
import { API_URL } from './config';
import { SessionManager } from './session';

export const session = new SessionManager(API_URL);

/**
 * The one API client for the app. Typed by the backend OpenAPI contract
 * (@mediconnect/api-client); auth is handled by the session's fetch.
 */
export const api = createApiClient({
  baseUrl: API_URL,
  fetch: session.fetch,
  csrf: session.mode === 'cookie',
  credentials: session.mode === 'cookie' ? 'include' : 'omit',
});

/** Web build only: Sanctum's CSRF cookie before the first write. */
export async function prepareWrites(): Promise<void> {
  if (session.mode === 'cookie') {
    await ensureCsrfCookie(API_URL);
  }
}
