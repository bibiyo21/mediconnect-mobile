import { SessionManager } from '../session';
import type { StoredSession } from '../tokenStore';

const API = 'https://api.test/api/v1';

function memoryStore(initial: StoredSession | null = null) {
  let value = initial;
  return {
    load: jest.fn(async () => value),
    save: jest.fn(async (s: StoredSession) => void (value = s)),
    clear: jest.fn(async () => void (value = null)),
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const refreshed = json(200, { success: true, data: { tokens: { access_token: 'access-1', refresh_token: 'refresh-1' }, device_id: 'device-1' } });

describe('SessionManager.currentAccessToken (realtime authorizer source)', () => {
  it('is null when signed out, without refreshing', async () => {
    const base = jest.fn();
    const session = new SessionManager(API, base, memoryStore(null), 'token');
    await session.restore(async () => false);
    await expect(session.currentAccessToken()).resolves.toBeNull();
    expect(base).not.toHaveBeenCalled();
  });

  it('refreshes once when the access token is missing, then returns it and keeps only the refresh token stored', async () => {
    const base = jest.fn(async () => refreshed);
    const store = memoryStore({ refreshToken: 'refresh-0', deviceId: 'device-1' });
    const session = new SessionManager(API, base, store, 'token');
    await session.restore(async () => false);

    await expect(session.currentAccessToken()).resolves.toBe('access-1');
    expect(base).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenCalledWith({ refreshToken: 'refresh-1', deviceId: 'device-1' });
  });

  it('is null on web (cookie mode), where the cookie carries the session', async () => {
    const base = jest.fn();
    const session = new SessionManager(API, base, memoryStore(null), 'cookie');
    await expect(session.currentAccessToken()).resolves.toBeNull();
    expect(base).not.toHaveBeenCalled();
  });
});
