/**
 * Which presence actions the doctor may offer. Transitions come from the stored `status`;
 * `effective_status` (BUSY) only changes the label, because the server refuses Break and
 * Away while a consultation is in progress (409 ACTIVE_CONSULTATION).
 */
export interface PresenceOffers {
  checkIn: boolean;
  checkOut: boolean;
  startBreak: boolean;
  endBreak: boolean;
  markAway: boolean;
  markAvailable: boolean;
}

export function transitionOffers(status: string, effectiveStatus: string): PresenceOffers {
  const inConsultation = effectiveStatus === 'BUSY';
  const open = status !== 'NOT_CHECKED_IN' && status !== 'OUT';
  return {
    checkIn: status === 'NOT_CHECKED_IN' || status === 'OUT',
    checkOut: open,
    startBreak: status === 'IN' && !inConsultation,
    endBreak: status === 'ON_BREAK',
    markAway: status === 'IN' && !inConsultation,
    markAvailable: status === 'TEMPORARILY_UNAVAILABLE',
  };
}

/** The label a doctor sees for the derived status. */
export function statusLabel(effectiveStatus: string): string {
  switch (effectiveStatus) {
    case 'IN':
      return 'Checked in';
    case 'BUSY':
      return 'In consultation';
    case 'ON_BREAK':
      return 'On break';
    case 'TEMPORARILY_UNAVAILABLE':
      return 'Away';
    case 'OUT':
      return 'Checked out';
    default:
      return 'Not checked in';
  }
}
