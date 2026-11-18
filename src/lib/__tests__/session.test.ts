import { SessionManager } from '../session';
import type { StoredSession } from '../tokenStore';

const API = 'https://api.test/api/v1';

function memoryStore(initial: StoredSession | null = null) {
  let value = initial;
  return {
    load: jest.fn(async () => value),
    save: jest.fn(async (s: StoredSession) => void (value = s)),
    clear: jest.fn(async () => void (value = null)),
    get current() {
      return value;
    },
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const refreshed = (n: number) => json(200, { success: true, data: { tokens: { access_token: `access-${n}`, refresh_token: `refresh-${n}` }, device_id: 'device-1' } });

describe('SessionManager (native token mode)', () => {
  it('restores a signed-in state from a stored refresh token', async () => {
    const store = memoryStore({ refreshToken: 'r0', deviceId: 'd' });
    const session = new SessionManager(API, jest.fn(), store, 'token');
    await session.restore(async () => false);
    expect(session.getState()).toEqual({ status: 'signedIn', signOutReason: null });
  });

  it('starts signed out without a stored token', async () => {
    const session = new SessionManager(API, jest.fn(), memoryStore(), 'token');
    await session.restore(async () => true);
    expect(session.getState().status).toBe('signedOut');
  });

  it('refreshes once for concurrent 401s and retries each request with the new token (single-flight)', async () => {
    const store = memoryStore();
    let refreshCalls = 0;
    const baseFetch = jest.fn(async (req: Request) => {
      if (req.url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        expect(await req.json()).toEqual({ refresh_token: 'refresh-0' });
        return refreshed(1);
      }
      return req.headers.get('Authorization') === 'Bearer access-1' ? json(200, { ok: true }) : json(401, { code: 'UNAUTHENTICATED' });
    });
    const session = new SessionManager(API, baseFetch, store, 'token');
    await session.signIn({ access_token: 'access-0', refresh_token: 'refresh-0', device_id: 'device-1' });

    const responses = await Promise.all([session.fetch(new Request(`${API}/auth/me`)), session.fetch(new Request(`${API}/auth/devices`))]);

    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(refreshCalls).toBe(1);
    expect(store.current).toEqual({ refreshToken: 'refresh-1', deviceId: 'device-1' });
  });

  it('signs out with reason "expired" and clears secure storage when the refresh is rejected', async () => {
    const store = memoryStore();
    const baseFetch = jest.fn(async (req: Request) => (req.url.endsWith('/auth/refresh') ? json(401, { code: 'REFRESH_TOKEN_INVALID' }) : json(401, {})));
    const session = new SessionManager(API, baseFetch, store, 'token');
    await session.signIn({ access_token: 'a', refresh_token: 'r', device_id: 'd' });

    const response = await session.fetch(new Request(`${API}/auth/me`));

    expect(response.status).toBe(401);
    expect(session.getState()).toEqual({ status: 'signedOut', signOutReason: 'expired' });
    expect(store.clear).toHaveBeenCalled();
  });

  it('keeps the session when the refresh fails because the device is offline', async () => {
    const store = memoryStore();
    const baseFetch = jest.fn(async (req: Request) => {
      if (req.url.endsWith('/auth/refresh')) throw new TypeError('Network request failed');
      return json(401, {});
    });
    const session = new SessionManager(API, baseFetch, store, 'token');
    await session.signIn({ access_token: 'a', refresh_token: 'r', device_id: 'd' });

    await session.fetch(new Request(`${API}/auth/me`));

    expect(session.getState().status).toBe('signedIn');
    expect(store.current).toEqual({ refreshToken: 'r', deviceId: 'd' });
  });

  it.each([429, 500, 503])('keeps the session and the stored token when the refresh gets a %i', async (status) => {
    const store = memoryStore();
    const baseFetch = jest.fn(async (req: Request) => (req.url.endsWith('/auth/refresh') ? json(status, {}) : json(401, {})));
    const session = new SessionManager(API, baseFetch, store, 'token');
    await session.signIn({ access_token: 'a', refresh_token: 'r', device_id: 'd' });

    const response = await session.fetch(new Request(`${API}/auth/me`));

    expect(response.status).toBe(401);
    expect(session.getState().status).toBe('signedIn');
    expect(store.current).toEqual({ refreshToken: 'r', deviceId: 'd' });
  });

  it('keeps the session when the refresh response is not JSON (e.g. a proxy error page)', async () => {
    const store = memoryStore();
    const baseFetch = jest.fn(async (req: Request) => (req.url.endsWith('/auth/refresh') ? new Response('<html>Bad gateway</html>', { status: 200 }) : json(401, {})));
    const session = new SessionManager(API, baseFetch, store, 'token');
    await session.signIn({ access_token: 'a', refresh_token: 'r', device_id: 'd' });

    await expect(session.fetch(new Request(`${API}/auth/me`))).resolves.toHaveProperty('status', 401);
    expect(session.getState().status).toBe('signedIn');
    expect(store.current).toEqual({ refreshToken: 'r', deviceId: 'd' });
  });

  it('discards a refresh that finishes after the user signed out (nothing written back to secure storage)', async () => {
    const store = memoryStore();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const baseFetch = jest.fn(async (req: Request) => {
      if (req.url.endsWith('/auth/refresh')) {
        await gate;
        return refreshed(1);
      }
      return json(401, {});
    });
    const session = new SessionManager(API, baseFetch, store, 'token');
    await session.signIn({ access_token: 'access-0', refresh_token: 'refresh-0', device_id: 'device-1' });

    const pending = session.fetch(new Request(`${API}/auth/me`));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await session.signOut('user');
    release();
    await pending;

    expect(session.getState()).toEqual({ status: 'signedOut', signOutReason: 'user' });
    expect(store.current).toBeNull();
    expect(baseFetch).toHaveBeenCalledTimes(2); // the request and the refresh; no retry with the discarded token
  });

  it('never refreshes on a failed login (no retry loop on auth endpoints)', async () => {
    const baseFetch = jest.fn(async () => json(401, {}));
    const session = new SessionManager(API, baseFetch, memoryStore(), 'token');
    await session.signIn({ access_token: 'a', refresh_token: 'r', device_id: 'd' });

    await session.fetch(new Request(`${API}/auth/login`, { method: 'POST' }));

    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes before the first request after a cold start (no access token in memory)', async () => {
    const store = memoryStore({ refreshToken: 'refresh-0', deviceId: 'device-1' });
    const seen: string[] = [];
    const baseFetch = jest.fn(async (req: Request) => {
      seen.push(`${new URL(req.url).pathname} ${req.headers.get('Authorization') ?? '-'}`);
      return req.url.endsWith('/auth/refresh') ? refreshed(1) : json(200, {});
    });
    const session = new SessionManager(API, baseFetch, store, 'token');
    await session.restore(async () => false);

    await session.fetch(new Request(`${API}/auth/me`));

    expect(seen).toEqual(['/api/v1/auth/refresh -', '/api/v1/auth/me Bearer access-1']);
  });

  it('does not persist anything when sign-in returns no refresh token', async () => {
    const store = memoryStore();
    const session = new SessionManager(API, jest.fn(), store, 'token');
    await session.signIn({ access_token: 'limited', refresh_token: null, device_id: 'd' });
    expect(store.save).not.toHaveBeenCalled();
  });
});

describe('SessionManager (web cookie mode)', () => {
  it('passes requests through without tokens and never touches storage', async () => {
    const store = memoryStore();
    const baseFetch = jest.fn(async () => json(200, {}));
    const session = new SessionManager(API, baseFetch, store, 'cookie');
    await session.restore(async () => true);
    await session.signIn(null);

    await session.fetch(new Request(`${API}/auth/me`));

    expect(session.getState().status).toBe('signedIn');
    const sent = (baseFetch.mock.calls[0] as unknown as [Request])[0];
    expect(sent.headers.get('Authorization')).toBeNull();
    expect(store.load).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });
});

describe('sign-out detail', () => {
  it('carries a detail such as the deletion date with the reason', async () => {
    const session = new SessionManager(API, jest.fn(), memoryStore(), 'token');
    await session.signOut('deletionRequested', '2026-12-18T03:00:00Z');
    expect(session.getState()).toEqual({ status: 'signedOut', signOutReason: 'deletionRequested', signOutDetail: '2026-12-18T03:00:00Z' });
  });
});
