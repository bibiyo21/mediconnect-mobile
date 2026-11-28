import { ApiError, newIdempotencyKey } from '@mediconnect/api-client';

/**
 * Idempotency-Key lifecycle for queue and consultation writes.
 * - One key per intent (for example `call:<entry id>`). A double tap reuses it, so the server answers once.
 * - A network failure keeps the key: the request may have reached the server, so the retry must replay it.
 * - A final server answer ends the intent. The next tap is a new intent with a new key, because call-next and
 *   the other 4xx answers are replayed for 48 hours. IDEMPOTENCY_IN_PROGRESS is not final (see keepsKey).
 */
export class IntentKeys {
  private readonly keys = new Map<string, string>();

  constructor(private readonly make: () => string = newIdempotencyKey) {}

  keyFor(intent: string): string {
    let key = this.keys.get(intent);
    if (key === undefined) {
      key = this.make();
      this.keys.set(intent, key);
    }
    return key;
  }

  /** Call after the request settles. `retryWithSameKey` is true while the answer is not final (see keepsKey). */
  settle(intent: string, retryWithSameKey: boolean): void {
    if (!retryWithSameKey) this.keys.delete(intent);
  }

  /** Number of intents with a live key (for tests). */
  get size(): number {
    return this.keys.size;
  }
}

/** A thrown value that is not a server answer (no status) means the request may or may not have landed. */
export function isNetworkFailure(error: unknown): boolean {
  return !(typeof error === 'object' && error !== null && 'status' in error && typeof (error as { status: unknown }).status === 'number');
}

/**
 * True when the key must be kept for the retry: a network failure (the request may have landed), or
 * IDEMPOTENCY_IN_PROGRESS (the first request with this key is still running, so it has no answer yet).
 */
export function keepsKey(error: unknown): boolean {
  return isNetworkFailure(error) || (error instanceof ApiError && error.code === 'IDEMPOTENCY_IN_PROGRESS');
}
