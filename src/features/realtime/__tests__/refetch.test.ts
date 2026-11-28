import { PAUSED_POLL_MS, refetchIntervalFor, shouldRefetch, STATUS_CHANGED_NOTICE_TYPES } from '../refetch';

describe('version compare for hints', () => {
  it('refetches on an equal or newer version, ignores an older one, and refetches with nothing held', () => {
    expect(shouldRefetch(5, 5)).toBe(true);
    expect(shouldRefetch(5, 6)).toBe(true);
    expect(shouldRefetch(5, 4)).toBe(false);
    expect(shouldRefetch(null, 1)).toBe(true);
    expect(shouldRefetch(undefined, 1)).toBe(true);
  });
});

describe('polling while paused', () => {
  it('polls every 30 seconds only while the socket is not connected', () => {
    expect(refetchIntervalFor(false)).toBe(PAUSED_POLL_MS);
    expect(PAUSED_POLL_MS).toBe(30_000);
    expect(refetchIntervalFor(true)).toBe(false);
  });
});

describe('status-changed notices', () => {
  it('recognises the two staff and automatic check-out types only', () => {
    expect(STATUS_CHANGED_NOTICE_TYPES.has('presence.changed_by_staff')).toBe(true);
    expect(STATUS_CHANGED_NOTICE_TYPES.has('presence.auto_checked_out')).toBe(true);
    expect(STATUS_CHANGED_NOTICE_TYPES.has('appointment.created')).toBe(false);
  });
});
