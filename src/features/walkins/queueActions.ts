/**
 * Which actions a doctor may offer on one entry. It mirrors the server's entry states; the server still decides
 * every refusal (windows, order, recall limit). Nothing here reads a clock or a limit.
 */
import type { ConsultationStatus, WalkInEntry } from './api';

export type QueueAction =
  | 'call'
  | 'recall'
  | 'skip'
  | 'noShow'
  | 'return'
  | 'priority'
  | 'startConsultation'
  | 'endConsultation'
  | 'interrupt'
  | 'resume';

export interface EntryContext {
  /** True for the first WAITING entry in call order: the only one the server will call next. */
  isFirstWaiting: boolean;
  /** The consultation's status, read for an IN_CONSULTATION entry. Null while it loads. */
  consultationStatus?: ConsultationStatus | null;
}

export function entryActions(entry: Pick<WalkInEntry, 'status' | 'consultation_id'>, ctx: EntryContext): QueueAction[] {
  switch (entry.status) {
    case 'WAITING':
      return ctx.isFirstWaiting ? ['call', 'priority'] : ['priority'];
    case 'CALLED':
      return [...(entry.consultation_id ? (['startConsultation'] as const) : []), 'recall', 'skip', 'noShow'];
    case 'IN_CONSULTATION':
      if (ctx.consultationStatus === 'IN_PROGRESS') return ['endConsultation', 'interrupt'];
      if (ctx.consultationStatus === 'INTERRUPTED') return ['resume', 'endConsultation'];
      return [];
    case 'SKIPPED':
      return ['return', 'noShow', 'priority'];
    default:
      // REGISTERED (not arrived yet), COMPLETED, NO_SHOW and CANCELLED have no doctor action.
      return [];
  }
}

/** True when the screen must read the consultation to know whether it is running or interrupted. */
export function needsConsultationRead(entry: Pick<WalkInEntry, 'status'>): boolean {
  return entry.status === 'IN_CONSULTATION';
}
