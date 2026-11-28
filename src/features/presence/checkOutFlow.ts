/**
 * The four-step check-out flow (brief D-E). Pure: the screen feeds it the preview and the
 * server's answers. A block stops the flow; the POST result is always the truth.
 */
import type { CheckOutBody, CheckOutDisposition, CheckOutReason } from './api';

export type CheckOutStep = 1 | 2 | 3 | 4;

export interface CheckOutFlow {
  step: CheckOutStep;
  reason: CheckOutReason | null;
  disposition: CheckOutDisposition;
  guestsInformed: boolean;
  confirmedNotify: boolean;
}

export const INITIAL_CHECK_OUT: CheckOutFlow = {
  step: 1,
  reason: null,
  disposition: 'HOLD_FOR_REASSIGNMENT',
  guestsInformed: false,
  confirmedNotify: false,
};

export type CheckOutAction =
  /** `blocked` is true when the preview lists any blocking item. */
  | { type: 'next'; blocked: boolean }
  | { type: 'back' }
  | { type: 'reason'; reason: CheckOutReason }
  | { type: 'disposition'; disposition: CheckOutDisposition }
  | { type: 'guests'; informed: boolean }
  | { type: 'confirmNotify'; confirmed: boolean }
  | { type: 'restart' };

export function reduceCheckOut(state: CheckOutFlow, action: CheckOutAction): CheckOutFlow {
  switch (action.type) {
    case 'next':
      if (state.step === 2 && action.blocked) return state;
      if (state.step === 3 && state.reason === null) return state;
      return state.step < 4 ? { ...state, step: (state.step + 1) as CheckOutStep } : state;
    case 'back':
      return state.step > 1 ? { ...state, step: (state.step - 1) as CheckOutStep } : state;
    case 'reason':
      return { ...state, reason: action.reason };
    case 'disposition':
      return { ...state, disposition: action.disposition };
    case 'guests':
      return { ...state, guestsInformed: action.informed };
    case 'confirmNotify':
      return { ...state, confirmedNotify: action.confirmed };
    case 'restart':
      return { ...INITIAL_CHECK_OUT };
  }
}

/** True when the POST may be sent. Cancelling walk-ins needs a second confirmation, and the in-person guest checkbox when guests are booked. */
export function canSubmit(state: CheckOutFlow, guestCount: number): boolean {
  if (state.step !== 4 || state.reason === null) return false;
  if (state.disposition === 'HOLD_FOR_REASSIGNMENT') return true;
  if (!state.confirmedNotify) return false;
  return guestCount === 0 || state.guestsInformed;
}

export function buildCheckOutBody(state: CheckOutFlow, guestCount: number, clinicLocationId: string): CheckOutBody {
  if (state.reason === null) throw new Error('A check-out reason is required.');
  const body: CheckOutBody = {
    clinic_location_id: clinicLocationId,
    reason: state.reason,
    walkin_disposition: state.disposition,
  };
  if (state.disposition === 'NOTIFY_AND_CANCEL' && guestCount > 0) {
    body.guests_informed_in_person = state.guestsInformed;
  }
  return body;
}
