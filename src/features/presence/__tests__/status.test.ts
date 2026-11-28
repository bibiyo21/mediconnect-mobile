import { statusLabel, transitionOffers } from '../status';
import { formatManilaTime, parseBreakMinutes } from '../format';
import { reduceCheckOut, INITIAL_CHECK_OUT, canSubmit, buildCheckOutBody } from '../checkOutFlow';

describe('transitionOffers (from the stored status)', () => {
  it('offers Break and Away only from IN', () => {
    const offers = transitionOffers('IN', 'IN');
    expect(offers.startBreak).toBe(true);
    expect(offers.markAway).toBe(true);
    expect(offers.endBreak).toBe(false);
    expect(offers.markAvailable).toBe(false);
  });

  it('offers no Break or Away while a consultation is in progress (BUSY is derived)', () => {
    const offers = transitionOffers('IN', 'BUSY');
    expect(offers.startBreak).toBe(false);
    expect(offers.markAway).toBe(false);
    expect(statusLabel('BUSY')).toBe('In consultation');
  });

  it('offers End break only from ON_BREAK, and Available only from TEMPORARILY_UNAVAILABLE', () => {
    expect(transitionOffers('ON_BREAK', 'ON_BREAK').endBreak).toBe(true);
    expect(transitionOffers('TEMPORARILY_UNAVAILABLE', 'TEMPORARILY_UNAVAILABLE').markAvailable).toBe(true);
    expect(transitionOffers('IN', 'IN').markAvailable).toBe(false);
  });

  it('offers check-in when not checked in or checked out, and check-out only while open', () => {
    expect(transitionOffers('NOT_CHECKED_IN', 'NOT_CHECKED_IN')).toMatchObject({ checkIn: true, checkOut: false });
    expect(transitionOffers('OUT', 'OUT')).toMatchObject({ checkIn: true, checkOut: false });
    expect(transitionOffers('ON_BREAK', 'ON_BREAK')).toMatchObject({ checkIn: false, checkOut: true });
  });
});

describe('format helpers', () => {
  it('renders Manila wall time from UTC', () => {
    expect(formatManilaTime('2026-11-28T00:30:00Z')).toBe('08:30');
    expect(formatManilaTime('2026-11-28T16:05:00Z')).toBe('00:05');
    expect(formatManilaTime(null)).toBe('');
  });

  it('accepts only 1 to 240 whole minutes for a break', () => {
    expect(parseBreakMinutes('15')).toBe(15);
    expect(parseBreakMinutes(' 240 ')).toBe(240);
    expect(parseBreakMinutes('0')).toBeNull();
    expect(parseBreakMinutes('241')).toBeNull();
    expect(parseBreakMinutes('1.5')).toBeNull();
    expect(parseBreakMinutes('')).toBeNull();
  });
});

describe('check-out flow reducer', () => {
  it('a block stops the flow at step 2', () => {
    const at2 = reduceCheckOut(INITIAL_CHECK_OUT, { type: 'next', blocked: false });
    expect(at2.step).toBe(2);
    expect(reduceCheckOut(at2, { type: 'next', blocked: true }).step).toBe(2);
    expect(reduceCheckOut(at2, { type: 'next', blocked: false }).step).toBe(3);
  });

  it('needs a reason before step 4', () => {
    const at3 = { ...INITIAL_CHECK_OUT, step: 3 as const };
    expect(reduceCheckOut(at3, { type: 'next', blocked: false }).step).toBe(3);
    const withReason = reduceCheckOut(at3, { type: 'reason', reason: 'PERSONAL' });
    expect(reduceCheckOut(withReason, { type: 'next', blocked: false }).step).toBe(4);
  });

  it('defaults to HOLD_FOR_REASSIGNMENT and restarts at step 1', () => {
    expect(INITIAL_CHECK_OUT.disposition).toBe('HOLD_FOR_REASSIGNMENT');
    const moved = reduceCheckOut({ ...INITIAL_CHECK_OUT, step: 4, reason: 'OTHER' }, { type: 'restart' });
    expect(moved).toEqual(INITIAL_CHECK_OUT);
  });

  it('NOTIFY_AND_CANCEL needs the second confirmation, and the guest checkbox when guests are booked', () => {
    const notify = { ...INITIAL_CHECK_OUT, step: 4 as const, reason: 'EMERGENCY' as const, disposition: 'NOTIFY_AND_CANCEL' as const };
    expect(canSubmit(notify, 0)).toBe(false);
    const confirmed = { ...notify, confirmedNotify: true };
    expect(canSubmit(confirmed, 0)).toBe(true);
    expect(canSubmit(confirmed, 2)).toBe(false);
    expect(canSubmit({ ...confirmed, guestsInformed: true }, 2)).toBe(true);
  });

  it('builds the POST body with the guest flag only for cancellation with guests', () => {
    const base = { ...INITIAL_CHECK_OUT, step: 4 as const, reason: 'END_OF_SHIFT' as const };
    expect(buildCheckOutBody(base, 3, 'loc-1')).toEqual({ clinic_location_id: 'loc-1', reason: 'END_OF_SHIFT', walkin_disposition: 'HOLD_FOR_REASSIGNMENT' });
    const notify = { ...base, disposition: 'NOTIFY_AND_CANCEL' as const, guestsInformed: true };
    expect(buildCheckOutBody(notify, 3, 'loc-1')).toMatchObject({ walkin_disposition: 'NOTIFY_AND_CANCEL', guests_informed_in_person: true });
    expect(buildCheckOutBody(notify, 0, 'loc-1')).not.toHaveProperty('guests_informed_in_person');
  });
});
