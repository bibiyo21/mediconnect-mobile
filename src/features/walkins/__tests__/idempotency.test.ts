import { IntentKeys, isNetworkFailure, keepsKey } from '../idempotency';
import { ApiError } from '@mediconnect/api-client';

describe('IntentKeys', () => {
  function sequence() {
    let n = 0;
    return () => `key-${++n}`;
  }

  it('reuses one key for the same intent until it settles (a double tap or a retry)', () => {
    const keys = new IntentKeys(sequence());
    expect(keys.keyFor('call:e1')).toBe('key-1');
    expect(keys.keyFor('call:e1')).toBe('key-1');
  });

  it('keeps the key after a network failure, so the retry replays it', () => {
    const keys = new IntentKeys(sequence());
    keys.keyFor('call:e1');
    keys.settle('call:e1', true);
    expect(keys.keyFor('call:e1')).toBe('key-1');
  });

  it('sends a fresh key after a final server answer (the 4xx replay window is 48 hours)', () => {
    const keys = new IntentKeys(sequence());
    keys.keyFor('call:e1');
    keys.settle('call:e1', false);
    expect(keys.keyFor('call:e1')).toBe('key-2');
  });

  it('gives different intents different keys and clears settled ones', () => {
    const keys = new IntentKeys(sequence());
    expect(keys.keyFor('call:e1')).not.toBe(keys.keyFor('skip:e1'));
    keys.settle('call:e1', false);
    keys.settle('skip:e1', false);
    expect(keys.size).toBe(0);
  });
});

describe('isNetworkFailure', () => {
  it('is true for a thrown value that is not a server answer', () => {
    expect(isNetworkFailure(new TypeError('Network request failed'))).toBe(true);
  });

  it('is false for any ApiError, including 429 and 409 CONCURRENT_MODIFICATION', () => {
    expect(isNetworkFailure(new ApiError(409, { code: 'CONCURRENT_MODIFICATION' }))).toBe(false);
    expect(isNetworkFailure(new ApiError(429, { code: 'RATE_LIMITED' }))).toBe(false);
  });
});

describe('keepsKey', () => {
  it('keeps the key on a network failure', () => {
    expect(keepsKey(new TypeError('Network request failed'))).toBe(true);
  });

  it('keeps the key on IDEMPOTENCY_IN_PROGRESS, because the first request has no answer yet', () => {
    expect(keepsKey(new ApiError(409, { code: 'IDEMPOTENCY_IN_PROGRESS' }))).toBe(true);
  });

  it('drops the key on any other server answer', () => {
    expect(keepsKey(new ApiError(409, { code: 'CONCURRENT_MODIFICATION' }))).toBe(false);
    expect(keepsKey(new ApiError(422, { code: 'VALIDATION_FAILED' }))).toBe(false);
  });
});
