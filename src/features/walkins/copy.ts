/**
 * Copy for the doctor queue. Keyed by the server's error code and reason_code only; never shows server internals,
 * names or notes. Protected-window wording follows walk-in-management.md §2F: never "appointments are always protected".
 */
import { ApiError } from '@mediconnect/api-client';
import { formatManilaTime } from '@/features/presence/format';
import { userMessage } from '@/lib/errors';
import { WalkInError, type PriorityReasonCode, type WalkInEntry } from './api';

const NOT_AVAILABLE: Record<string, string> = {
  on_break: 'End your break first.',
  unavailable: 'You are marked away. Mark yourself available first.',
  not_checked_in: 'Check in at this clinic first.',
  checked_out: 'You have checked out. Check in again first.',
  no_doctor: 'This queue has no doctor assigned.',
  no_assignment: 'You have no active assignment at this clinic.',
  doctor_not_active: 'Your profile is not active, so you cannot call patients.',
  location_not_active: 'This clinic location is not active right now.',
};

const QUEUE_CLOSED: Record<string, string> = {
  paused: 'This queue is paused: no new walk-ins can join. Calls still work.',
  closed: 'This queue is closed for today.',
  cutoff_passed: 'The cutoff for this queue has passed.',
  clinic_closed_today: 'The clinic is closed today.',
  not_today: 'This queue is not for today.',
};

const ALREADY_CALLING: Record<string, string> = {
  other_queue: 'You already have a called patient in another queue. Finish or skip that patient first.',
  previous_day: 'A patient from an earlier day is still called. The clinic desk has to clear that entry first.',
};

const ACTIVE_CONSULTATION: Record<string, string> = {
  called: 'A patient is called. Start, skip or mark no-show first.',
  in_progress: 'Finish the consultation in progress first.',
  interrupted: 'An interrupted consultation is open. Resume or end it first.',
};

/** Formats the protected-window refusal. The instant is shown in Manila time, as an estimate of when the window ends. */
export function protectedWindowText(error: WalkInError): string {
  const until = error.blockedUntil ? ` until about ${formatManilaTime(error.blockedUntil)}` : '';
  if (error.reasonCode === 'hold') return `This time is held${until}. Call an urgent patient only with a reason, or wait.`;
  return `Appointment times are protected${until} unless the clinic prioritises an urgent patient.`;
}

/** Text for a failed queue action. Codes come from docs/api-specification.md §2.9; unknown codes fall back to a safe line. */
export function queueErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return userMessage(error);
  const reason = error instanceof WalkInError ? error.reasonCode : null;
  const walkIn = error instanceof WalkInError ? error : null;

  switch (error.code) {
    case 'APPOINTMENT_WINDOW_PROTECTED':
      return walkIn ? protectedWindowText(walkIn) : 'The next visit is protected. Wait or check the schedule.';
    case 'DOCTOR_NOT_AVAILABLE':
      return (reason && NOT_AVAILABLE[reason]) || 'You cannot call patients right now.';
    case 'QUEUE_CLOSED':
      return (reason && QUEUE_CLOSED[reason]) || 'This queue is not open for calls.';
    case 'DOCTOR_ALREADY_CALLING':
      return (reason && ALREADY_CALLING[reason]) || 'You already have a called patient. Finish that patient first.';
    case 'ENTRY_ALREADY_CALLED':
      return 'Another patient in this queue is already called. Start, skip or mark no-show first.';
    case 'NOT_NEXT_IN_ORDER':
      return 'The next patient in order is someone else. The list has been refreshed.';
    case 'QUEUE_EMPTY':
      return 'No one is waiting right now.';
    case 'RECALL_LIMIT_REACHED':
      return 'The recall limit is reached for this patient. Skip or mark no-show instead.';
    case 'ACTIVE_CONSULTATION':
      return (reason && ACTIVE_CONSULTATION[reason]) || 'Finish the consultation in progress first.';
    case 'INVALID_STATE_TRANSITION':
      return 'That action no longer applies. The list has been refreshed.';
    case 'IDEMPOTENCY_IN_PROGRESS':
      return 'This action is still going through. The list has been refreshed; check it before you try again.';
    case 'CONCURRENT_MODIFICATION':
      return 'The queue is busy. Try again in a moment.';
    case 'CAPACITY_OVERRIDE_REQUIRED':
    case 'VALIDATION_FAILED':
      return 'That change was not accepted. Check the reason and try again.';
    case 'NOT_FOUND':
      return 'This patient is no longer in the queue. The list has been refreshed.';
    case 'FORBIDDEN':
    case 'AUTHORIZATION_FAILED':
      return 'You cannot do this at this clinic.';
    default:
      return userMessage(error);
  }
}

/** The line shown under a patient's name: the estimate as a range, always labelled as an estimate. */
export function estimateText(entry: Pick<WalkInEntry, 'estimate'>): string | null {
  const e = entry.estimate;
  if (!e) return null;
  if (e.wait_status === 'NOT_AVAILABLE_YET') return 'Estimate later in the day';
  if (e.min_minutes === null || e.max_minutes === null) return 'Estimate not shown';
  return `About ${e.min_minutes} to ${e.max_minutes} min · estimate, not a guarantee`;
}

/** Only the server's label. The typed card name is never shown: an HMO claim is not verified. */
export function hmoText(entry: Pick<WalkInEntry, 'hmo_claim'>): string | null {
  return entry.hmo_claim ? entry.hmo_claim.label : null;
}

export const PRIORITY_REASON_LABELS: Record<PriorityReasonCode, string> = {
  SENIOR_PWD: 'Senior citizen or PWD',
  PREGNANT: 'Pregnant',
  DOCTOR_REQUEST: 'Doctor requested',
  STAFF_CONCERN: 'Staff concern',
  OTHER: 'Other (see clinic desk)',
};

export const OVERRIDE_GATE_TITLE = 'Call during a protected time?';
export const OVERRIDE_GATE_BODY =
  'Appointment times are protected unless the clinic prioritises an urgent patient. This queue is not an emergency service. The reason you choose is recorded for the clinic; no details are shown to the patient.';
