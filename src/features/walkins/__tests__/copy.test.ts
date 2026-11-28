import { ApiError } from '@mediconnect/api-client';
import { WalkInError } from '../api';
import { estimateText, hmoText, protectedWindowText, queueErrorMessage } from '../copy';

function refusal(status: number, code: string, reasonCode: string | null, errors?: Record<string, string[]>) {
  return new WalkInError(status, { code, message: 'x', errors: errors ?? {}, reason_code: reasonCode } as never);
}

describe('queueErrorMessage (real backend codes and reason codes)', () => {
  it('APPOINTMENT_WINDOW_PROTECTED: appointment wording with the window time, never "always protected"', () => {
    const text = queueErrorMessage(refusal(409, 'APPOINTMENT_WINDOW_PROTECTED', 'appointment', { blocked_until: ['2026-11-28T03:00:00Z'] }));
    expect(text).toMatch(/^A booked patient's time is reserved until about /);
    expect(text).toContain('Wait, or call this patient now with a reason.');
    expect(text).not.toMatch(/always/i);
  });

  it('APPOINTMENT_WINDOW_PROTECTED with reason hold uses the hold wording', () => {
    expect(queueErrorMessage(refusal(409, 'APPOINTMENT_WINDOW_PROTECTED', 'hold'))).toMatch(/^This time is held/);
  });

  it('DOCTOR_NOT_AVAILABLE maps each reason code', () => {
    expect(queueErrorMessage(refusal(409, 'DOCTOR_NOT_AVAILABLE', 'on_break'))).toBe('End your break first.');
    expect(queueErrorMessage(refusal(409, 'DOCTOR_NOT_AVAILABLE', 'unavailable'))).toMatch(/marked away/);
    expect(queueErrorMessage(refusal(409, 'DOCTOR_NOT_AVAILABLE', 'not_checked_in'))).toBe('Check in at this clinic first.');
    expect(queueErrorMessage(refusal(409, 'DOCTOR_NOT_AVAILABLE', 'no_assignment'))).toMatch(/no active assignment/);
  });

  it('QUEUE_CLOSED and DOCTOR_ALREADY_CALLING map their reason codes', () => {
    expect(queueErrorMessage(refusal(409, 'QUEUE_CLOSED', 'paused'))).toBe('This queue is paused: no new walk-ins can join. Calls still work.');
    expect(queueErrorMessage(refusal(409, 'QUEUE_CLOSED', 'not_today'))).toBe('This queue is not for today.');
    expect(queueErrorMessage(refusal(409, 'DOCTOR_ALREADY_CALLING', 'previous_day'))).toMatch(/earlier day/);
    expect(queueErrorMessage(refusal(409, 'DOCTOR_ALREADY_CALLING', 'other_queue'))).toMatch(/another queue/);
  });

  it('ACTIVE_CONSULTATION maps called, in_progress and interrupted', () => {
    expect(queueErrorMessage(refusal(409, 'ACTIVE_CONSULTATION', 'called'))).toMatch(/A patient is called/);
    expect(queueErrorMessage(refusal(409, 'ACTIVE_CONSULTATION', 'in_progress'))).toMatch(/in progress/);
    expect(queueErrorMessage(refusal(409, 'ACTIVE_CONSULTATION', 'interrupted'))).toMatch(/interrupted/);
  });

  it('order, recall, empty and state codes get a plain line', () => {
    expect(queueErrorMessage(refusal(409, 'NOT_NEXT_IN_ORDER', null))).toMatch(/next patient in order/);
    expect(queueErrorMessage(refusal(409, 'RECALL_LIMIT_REACHED', null))).toMatch(/recall limit/);
    expect(queueErrorMessage(refusal(409, 'QUEUE_EMPTY', null))).toBe('No one is waiting right now.');
    expect(queueErrorMessage(refusal(409, 'INVALID_STATE_TRANSITION', null))).toMatch(/no longer applies/);
    expect(queueErrorMessage(refusal(409, 'CONCURRENT_MODIFICATION', null))).toMatch(/busy/);
  });

  it('an unknown code falls back to the shared message, and a non-API error to the connection line', () => {
    expect(queueErrorMessage(new ApiError(418, { code: 'SOMETHING_NEW', message: 'Teapot' }))).toBe('Teapot');
    expect(queueErrorMessage(new TypeError('boom'))).toBe('We could not reach MediConnect. Check your connection and try again.');
  });
});

describe('display helpers', () => {
  it('shows the estimate as a range, always labelled as an estimate', () => {
    expect(estimateText({ estimate: { min_minutes: 10, max_minutes: 20, wait_status: 'ESTIMATED' } } as never)).toBe(
      'About 10 to 20 min · estimate, not a guarantee',
    );
    expect(estimateText({ estimate: { min_minutes: null, max_minutes: null, wait_status: 'NOT_AVAILABLE_YET' } } as never)).toBe('No estimate yet');
  });

  it('shows only the server label for an HMO claim, never the typed card name', () => {
    expect(hmoText({ hmo_claim: { label: 'Patient says HMO: not verified', card_name_text: 'Typed Name' } } as never)).toBe(
      'Patient says HMO: not verified',
    );
    expect(hmoText({ hmo_claim: null } as never)).toBeNull();
  });

  it('formats the protected window in Manila time', () => {
    const error = refusal(409, 'APPOINTMENT_WINDOW_PROTECTED', 'appointment', { blocked_until: ['2026-11-28T03:00:00Z'] });
    expect(protectedWindowText(error)).toContain('11:00');
  });
});
