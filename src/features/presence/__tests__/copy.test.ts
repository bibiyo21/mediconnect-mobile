import { ApiError } from '@mediconnect/api-client';
import { PresenceError } from '../api';
import { checkInReasonText, checkOutBlockText, presenceErrorMessage } from '../copy';

function apiError(status: number, code: string, reasonCode?: string) {
  return new PresenceError(status, { success: false, message: 'x', errors: {}, code, request_id: null, reason_code: reasonCode ?? null });
}

describe('presenceErrorMessage', () => {
  it('explains an active consultation, and the called case (HAG-43)', () => {
    expect(presenceErrorMessage(apiError(409, 'ACTIVE_CONSULTATION', 'in_progress'))).toBe('Finish the consultation first.');
    expect(presenceErrorMessage(apiError(409, 'ACTIVE_CONSULTATION', 'called'))).toBe('A patient is called. Start, skip or mark no-show first.');
  });

  it('asks the doctor to refresh after an invalid transition', () => {
    expect(presenceErrorMessage(apiError(409, 'INVALID_STATE_TRANSITION', 'invalid_transition'))).toBe('Your status changed. We refreshed it.');
  });

  it('maps the real backend reason codes, which all arrive as INVALID_STATE_TRANSITION', () => {
    expect(presenceErrorMessage(apiError(409, 'INVALID_STATE_TRANSITION', 'open_session'))).toBe(
      'You are checked in at another clinic or session. Check out there first.',
    );
    expect(presenceErrorMessage(apiError(409, 'INVALID_STATE_TRANSITION', 'not_checked_in'))).toBe(
      'You are not checked in. We refreshed your status.',
    );
  });

  it('maps a concurrent change', () => {
    expect(presenceErrorMessage(apiError(409, 'CONCURRENT_MODIFICATION', 'change_in_progress'))).toBe('Another change is being saved. Try again.');
  });

  it('maps each check-in reason code to its own text', () => {
    for (const reason of ['doctor_not_active', 'location_not_active', 'no_assignment', 'no_service_mode', 'clinic_closed', 'closed_holiday', 'outside_hours']) {
      const text = presenceErrorMessage(apiError(422, 'VALIDATION_FAILED', reason));
      expect(text).toEqual(checkInReasonText(reason));
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it('adds the opening time for outside_hours when known', () => {
    expect(checkInReasonText('outside_hours', '08:30')).toBe('You are outside your scheduled hours here. Check-in opens at 08:30.');
  });

  it('falls back to the shared message for other errors and non-API errors', () => {
    expect(presenceErrorMessage(new ApiError(429, { success: false, message: 'Too many', errors: {}, code: 'RATE_LIMITED', request_id: null }))).toBe(
      'Too many attempts. Please wait a few minutes and try again.',
    );
    expect(presenceErrorMessage(new Error('network'))).toBe('We could not reach MediConnect. Check your connection and try again.');
  });

  it('asks for the authenticator app when a step-up is required', () => {
    expect(presenceErrorMessage(apiError(403, 'STEP_UP_REQUIRED'))).toBe('Confirm it is you with your authenticator app first.');
  });
});

describe('checkOutBlockText', () => {
  it('names the consultation states without ids', () => {
    expect(checkOutBlockText('ACTIVE_CONSULTATION', 'in_progress')).toBe('A consultation is in progress. Finish it first.');
    expect(checkOutBlockText('ACTIVE_CONSULTATION', 'interrupted')).toBe('A consultation is interrupted. Resume it, then end it first.');
    expect(checkOutBlockText('ACTIVE_CONSULTATION', 'called')).toBe('A patient is called. Start, skip or mark no-show first.');
  });

  it('explains a not_checked_in block instead of the generic text', () => {
    expect(checkOutBlockText('INVALID_STATE_TRANSITION', 'not_checked_in')).toContain('not checked in');
  });
});
