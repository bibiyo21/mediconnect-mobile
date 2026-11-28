/** Request shape of the queue writes: the Idempotency-Key sits in the header, and only a reason code is sent. */
import { callEntry, setEntryPriority } from '../api';

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  api: { GET: jest.fn(), POST: (...args: unknown[]) => mockPost(...args) },
  prepareWrites: async () => undefined,
}));

const ok = (data: unknown) => ({ data: { data }, response: new Response(null, { status: 200 }) });

beforeEach(() => mockPost.mockReset());

describe('queue write requests', () => {
  it('a normal call sends the key and no override', async () => {
    mockPost.mockResolvedValue(ok({ id: 'e1' }));
    await callEntry('e1', 'key-1', null);
    const [path, init] = mockPost.mock.calls[0];
    expect(path).toBe('/walk-ins/{id}/call');
    expect(init.params).toEqual({ path: { id: 'e1' }, header: { 'Idempotency-Key': 'key-1' } });
    expect(init.body).toEqual({});
  });

  it('an urgent override sends only the reason code', async () => {
    mockPost.mockResolvedValue(ok({ id: 'e1' }));
    await callEntry('e1', 'key-2', 'PREGNANT');
    expect(mockPost.mock.calls[0][1].body).toEqual({ override_reason_code: 'PREGNANT' });
  });

  it('a priority change sends codes only, and no reason for NORMAL', async () => {
    mockPost.mockResolvedValue(ok({ id: 'e1' }));
    await setEntryPriority('e1', 'key-3', 'NORMAL', 'OTHER');
    expect(mockPost.mock.calls[0][1].body).toEqual({ priority_level: 'NORMAL' });
    await setEntryPriority('e1', 'key-4', 'URGENT', 'STAFF_CONCERN');
    expect(mockPost.mock.calls[1][1].body).toEqual({ priority_level: 'URGENT', priority_reason_code: 'STAFF_CONCERN' });
    expect(JSON.stringify(mockPost.mock.calls[1][1].body)).not.toMatch(/note/);
  });

  it('a refusal keeps its reason_code and blocked_until on the thrown error', async () => {
    mockPost.mockResolvedValue({
      error: { code: 'APPOINTMENT_WINDOW_PROTECTED', message: 'x', reason_code: 'appointment', errors: { blocked_until: ['2026-11-28T03:00:00Z'] } },
      response: new Response(null, { status: 409 }),
    });
    await expect(callEntry('e1', 'key-5', null)).rejects.toMatchObject({ status: 409, code: 'APPOINTMENT_WINDOW_PROTECTED', reasonCode: 'appointment', blockedUntil: '2026-11-28T03:00:00Z' });
  });
});
