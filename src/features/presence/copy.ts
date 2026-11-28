/** Error and reason copy for the presence screens. Never shows server internals or patient data. */
import { ApiError } from '@mediconnect/api-client';
import { userMessage } from '@/lib/errors';
import { PresenceError } from './api';

const CHECK_IN_REASON: Record<string, string> = {
  doctor_not_active: 'Your profile is not active yet, so you cannot check in.',
  location_not_active: 'This clinic location is not active right now.',
  no_assignment: 'You do not have an active assignment at this clinic.',
  no_service_mode: 'No in-person service is set up for this clinic.',
  clinic_closed: 'The clinic is closed now.',
  closed_holiday: 'The clinic is closed today for a holiday.',
  outside_hours: 'You are outside your scheduled hours here.',
};

/** Why a check-in is not allowed, from the server's reason_code. `opensAt` is a Manila time label, when known. */
export function checkInReasonText(reasonCode: string | null | undefined, opensAt?: string | null): string {
  const base = (reasonCode && CHECK_IN_REASON[reasonCode]) || 'Check-in is not available right now.';
  if (reasonCode === 'outside_hours' && opensAt) return `${base} Check-in opens at ${opensAt}.`;
  return base;
}

/** The text for a failed presence request, by the server's code and reason_code (the backend sends INVALID_STATE_TRANSITION with a reason_code). */
export function presenceErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return userMessage(error);
  const reason = error instanceof PresenceError ? error.reasonCode : null;

  if (error.code === 'ACTIVE_CONSULTATION') {
    if (reason === 'called') return 'A patient is called. Start, skip or mark no-show first.';
    return 'Finish the consultation first.';
  }
  // reason_code first: the backend sends all three of these with code INVALID_STATE_TRANSITION.
  if (reason === 'open_session') {
    return 'You are checked in at another clinic or session. Check out there first.';
  }
  if (reason === 'not_checked_in') {
    return 'You are not checked in. We refreshed your status.';
  }
  if (error.code === 'INVALID_STATE_TRANSITION' || reason === 'invalid_transition') {
    return 'Your status changed. We refreshed it.';
  }
  if (error.code === 'CONCURRENT_MODIFICATION' || reason === 'change_in_progress') {
    return 'Another change is being saved. Try again.';
  }
  if (error.status === 422 && reason && CHECK_IN_REASON[reason]) {
    return checkInReasonText(reason);
  }
  if (error.code === 'MFA_REQUIRED' || error.code === 'STEP_UP_REQUIRED') {
    return 'Confirm it is you with your authenticator app first.';
  }
  return userMessage(error);
}

/** Copy for one blocking item on the check-out preview. */
export function checkOutBlockText(code: string, reasonCode: string): string {
  if (reasonCode === 'interrupted') return 'A consultation is interrupted. Resume it, then end it first.';
  if (reasonCode === 'in_progress') return 'A consultation is in progress. Finish it first.';
  if (reasonCode === 'called' || code === 'CALLED') return 'A patient is called. Start, skip or mark no-show first.';
  if (reasonCode === 'not_checked_in') return 'You are not checked in, so there is nothing to check out of. Refresh to see your status.';
  if (code === 'ACTIVE_CONSULTATION') return 'A consultation is in progress. Finish it first.';
  return 'Something blocks check-out right now. Resolve it, then check again.';
}

const SERVICE_MODE_LABEL: Record<string, string> = {
  APPOINTMENT: 'Appointments only',
  WALK_IN: 'Walk-ins only',
  BOTH: 'Appointments and walk-ins',
};

/** A shift's service mode as a doctor reads it. Unknown codes are shown without the raw enum. */
export function serviceModeLabel(mode: string): string {
  return SERVICE_MODE_LABEL[mode] ?? 'Service set up';
}
