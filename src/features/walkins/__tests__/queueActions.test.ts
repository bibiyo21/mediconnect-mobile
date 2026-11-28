import { entryActions } from '../queueActions';

const base = { consultation_id: null as string | null };

describe('entryActions (the action set per status)', () => {
  it('offers call and priority only on the first waiting entry; other waiting entries get priority only', () => {
    expect(entryActions({ status: 'WAITING', ...base }, { isFirstWaiting: true })).toEqual(['call', 'priority']);
    expect(entryActions({ status: 'WAITING', ...base }, { isFirstWaiting: false })).toEqual(['priority']);
  });

  it('CALLED: start when a consultation exists, then recall, skip and no-show', () => {
    expect(entryActions({ status: 'CALLED', consultation_id: 'c1' }, { isFirstWaiting: false })).toEqual(['startConsultation', 'recall', 'skip', 'noShow']);
    expect(entryActions({ status: 'CALLED', consultation_id: null }, { isFirstWaiting: false })).toEqual(['recall', 'skip', 'noShow']);
  });

  it('IN_CONSULTATION: interrupt and end while in progress; resume and end while interrupted; nothing until the status is read', () => {
    const entry = { status: 'IN_CONSULTATION' as const, ...base };
    expect(entryActions(entry, { isFirstWaiting: false, consultationStatus: 'IN_PROGRESS' })).toEqual(['endConsultation', 'interrupt']);
    expect(entryActions(entry, { isFirstWaiting: false, consultationStatus: 'INTERRUPTED' })).toEqual(['resume', 'endConsultation']);
    expect(entryActions(entry, { isFirstWaiting: false, consultationStatus: null })).toEqual([]);
  });

  it('SKIPPED: return, no-show and priority', () => {
    expect(entryActions({ status: 'SKIPPED', ...base }, { isFirstWaiting: false })).toEqual(['return', 'noShow', 'priority']);
  });

  it('REGISTERED, COMPLETED, NO_SHOW and CANCELLED have no doctor action', () => {
    for (const status of ['REGISTERED', 'COMPLETED', 'NO_SHOW', 'CANCELLED'] as const) {
      expect(entryActions({ status, ...base }, { isFirstWaiting: true })).toEqual([]);
    }
  });
});
