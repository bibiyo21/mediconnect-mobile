/**
 * Session lifecycle for the patient app (D-04).
 *
 * Native (iOS/Android): short-lived access token in memory, rotating refresh
 * token in SecureStore. Every refresh token works once and the server treats
 * reuse as theft, so refreshes are single-flight: concurrent 401s wait for the
 * same refresh instead of each spending the token.
 *
 * Web build: Sanctum session cookie; nothing is stored by this module.
 */
import { Platform } from 'react-native';
import { tokenStore, type StoredSession } from './tokenStore';

export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';
export type SignOutReason = 'user' | 'expired' | 'deletionRequested' | null;

export interface SessionState {
  status: SessionStatus;
  signOutReason: SignOutReason;
  /** Shown with the reason, for example the date an account deletion takes effect. */
  signOutDetail?: string;
}

export interface IssuedTokens {
  access_token: string | null;
  refresh_token: string | null;
  device_id: string;
}

type Listener = (state: SessionState) => void;
type FetchLike = (input: Request) => Promise<Response>;

export class SessionManager {
  readonly mode: 'token' | 'cookie';
  private state: SessionState = { status: 'restoring', signOutReason: null };
  private accessToken: string | null = null;
  private stored: StoredSession | null = null;
  private refreshing: Promise<boolean> | null = null;
  /** Bumped on every sign-in and sign-out; a refresh that started before one is discarded. */
  private generation = 0;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly apiUrl: string,
    private readonly baseFetch: FetchLike = (input) => globalThis.fetch(input),
    private readonly store = tokenStore,
    mode: 'token' | 'cookie' = Platform.OS === 'web' ? 'cookie' : 'token',
  ) {
    this.mode = mode;
  }

  getState = (): SessionState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Called once at app start, behind the splash screen. */
  async restore(signedInWithCookie: () => Promise<boolean>): Promise<void> {
    if (this.mode === 'cookie') {
      this.setState({ status: (await signedInWithCookie()) ? 'signedIn' : 'signedOut', signOutReason: null });
      return;
    }

    this.stored = await this.store.load();
    // Optimistic: with a stored refresh token the user is signed in; the first
    // request refreshes the access token (and signs out if that fails).
    this.setState({ status: this.stored ? 'signedIn' : 'signedOut', signOutReason: null });
  }

  /** After login, registration or MFA verification. */
  async signIn(tokens: IssuedTokens | null): Promise<void> {
    this.generation += 1;
    if (this.mode === 'token' && tokens) {
      this.accessToken = tokens.access_token;
      this.stored = tokens.refresh_token ? { refreshToken: tokens.refresh_token, deviceId: tokens.device_id } : null;
      if (this.stored) {
        await this.store.save(this.stored);
      }
    }
    this.setState({ status: 'signedIn', signOutReason: null });
  }

  async signOut(reason: SignOutReason = 'user', detail?: string): Promise<void> {
    this.generation += 1;
    this.accessToken = null;
    this.stored = null;
    if (this.mode === 'token') {
      await this.store.clear();
    }
    this.setState({ status: 'signedOut', signOutReason: reason, ...(detail ? { signOutDetail: detail } : {}) });
  }

  /**
   * fetch for the API client: adds the bearer token, and on a 401 refreshes
   * once (shared by all concurrent callers) and retries the request once.
   */
  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request && !init ? input : new Request(input, init);
    if (this.mode === 'cookie') {
      return this.baseFetch(request);
    }

    if (!this.accessToken && this.stored) {
      await this.refresh();
    }

    const retry = request.clone();
    const response = await this.baseFetch(this.withToken(request));

    if (response.status !== 401 || !this.stored || isAuthEndpoint(request.url)) {
      return response;
    }

    return (await this.refresh()) ? this.baseFetch(this.withToken(retry)) : response;
  };

  /** Single-flight refresh. Resolves true when a new access token is available. */
  refresh(): Promise<boolean> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const current = this.stored;
    if (!current) return false;
    const generation = this.generation;
    // The user signed out or in while this refresh was running: drop its result.
    const superseded = () => generation !== this.generation;

    let response: Response;
    try {
      response = await this.baseFetch(
        new Request(`${this.apiUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh_token: current.refreshToken }),
        }),
      );
    } catch {
      // Offline or server unreachable: keep the session; the next request tries again.
      return false;
    }

    if (superseded()) return false;

    if (response.status === 401 || response.status === 422) {
      // Expired, revoked or reused (401), or a stored token the server cannot accept (422): the session is over.
      await this.signOut('expired');
      return false;
    }

    if (!response.ok) {
      // Rate limited (429) or a server problem (5xx): the token is still good; keep the session and try again later.
      return false;
    }

    let body: { data?: { tokens?: { access_token?: string; refresh_token?: string }; device_id?: string } };
    try {
      body = await response.json();
    } catch {
      // Not the API's JSON (e.g. a proxy error page): treat as a temporary failure.
      return false;
    }
    if (superseded()) return false;

    const tokens = body.data?.tokens;
    if (!tokens?.access_token || !tokens.refresh_token) {
      await this.signOut('expired');
      return false;
    }

    this.accessToken = tokens.access_token;
    this.stored = { refreshToken: tokens.refresh_token, deviceId: body.data?.device_id ?? current.deviceId };
    await this.store.save(this.stored);
    return true;
  }

  private withToken(request: Request): Request {
    if (!this.accessToken) return request;
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${this.accessToken}`);
    return new Request(request, { headers });
  }

  private setState(next: SessionState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener(next));
  }
}

/** Requests that must never trigger a refresh-and-retry loop. */
function isAuthEndpoint(url: string): boolean {
  return /\/auth\/(login|refresh|register|mfa\/verify)$/.test(new URL(url).pathname);
}
