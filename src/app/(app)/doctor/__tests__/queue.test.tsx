/**
 * Doctor queue screen (5.9-M2): the override confirm flow, the priority dialog (codes only), the interrupt and
 * resume offers, and the error copy. The API is mocked with synthetic data; the real WalkInError class is used.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';
import * as walkinApi from '@/features/walkins/api';
import { WalkInError } from '@/features/walkins/api';
import { usePresenceState } from '@/features/presence/hooks';
import { useRealtimeStatus } from '@/features/realtime/RealtimeProvider';
import QueueScreen from '../queue';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/components/ui/Screen', () => {
  const { Text: T, View: V } = jest.requireActual('react-native');
  return { Screen: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <V><T accessibilityRole="header">{title}</T>{children}</V>
  ) };
});
jest.mock('@/features/realtime/useRefetchOnFocus', () => ({ useRefetchOnFocus: () => undefined }));
jest.mock('@/features/realtime/RealtimeProvider', () => ({ useRealtimeStatus: jest.fn() }));
jest.mock('@/features/presence/hooks', () => ({ usePresenceState: jest.fn(), useOffline: () => false }));
jest.mock('@/features/doctors/api', () => ({ fetchMyDoctorProfile: jest.fn(async () => ({ id: 'd1' })) }));
jest.mock('@/features/walkins/api', () => {
  const actual = jest.requireActual('@/features/walkins/api');
  return {
    ...actual,
    fetchBoard: jest.fn(),
    fetchConsultation: jest.fn(),
    callEntry: jest.fn(),
    callNext: jest.fn(),
    startConsultation: jest.fn(),
    endConsultation: jest.fn(),
    interruptConsultation: jest.fn(),
    resumeConsultation: jest.fn(),
    setEntryPriority: jest.fn(),
    recallEntry: jest.fn(),
    skipEntry: jest.fn(),
    noShowEntry: jest.fn(),
    returnEntry: jest.fn(),
    pauseQueue: jest.fn(),
    openQueue: jest.fn(),
  };
});

const mocked = walkinApi as unknown as Record<string, jest.Mock>;

/** Synthetic entries only: no real names, phones or HMO numbers. */
function entry(overrides: Partial<walkinApi.WalkInEntry>): walkinApi.WalkInEntry {
  return {
    id: 'e1',
    label: 'A-01',
    queue_number: 1,
    status: 'WAITING',
    queue_id: 'q1',
    priority_level: 'NORMAL',
    priority_reason_code: null,
    name: 'Ana Reyes',
    is_guest: false,
    recall_count: 0,
    consultation_id: null,
    hmo_claim: null,
    estimate: null,
    ...overrides,
  };
}

function board(entries: walkinApi.WalkInEntry[], status: 'OPEN' | 'PAUSED' | 'CLOSED' = 'OPEN'): walkinApi.QueueBoard {
  return {
    clinic_location_id: 'loc1',
    local_date: '2026-11-28',
    restricted: false,
    queues: [{ id: 'q1', status, doctor_profile_id: 'd1', doctor_name: 'Dr Test', live_count: entries.length, entries }],
  };
}

const PAUSED_COPY = 'This queue is paused: no new walk-ins can join. You can still call patients already in it.';

/** Presses inside act: this React build applies the state change asynchronously otherwise. */
async function tap(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return await render(
    <QueryClientProvider client={client}>
      <View>
        <QueueScreen />
      </View>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(usePresenceState).mockReturnValue({
    data: { clinic_location_id: 'loc1', status: 'IN', effective_status: 'IN' },
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  } as never);
  jest.mocked(useRealtimeStatus).mockReturnValue({ live: true, refetchInterval: false, statusChanged: false, clearStatusChanged: () => {} });
});

afterEach(async () => {
  await cleanup();
});

describe('override confirm (urgent call during a protected window)', () => {
  it('shows the gate wording and sends the chosen reason code as override_reason_code, after a confirm step', async () => {
    const triaged = entry({ id: 'e1', label: 'A-01', priority_level: 'URGENT', priority_reason_code: 'PREGNANT' });
    mocked.fetchBoard.mockResolvedValue(board([triaged]));
    mocked.callEntry
      .mockRejectedValueOnce(new WalkInError(409, { code: 'APPOINTMENT_WINDOW_PROTECTED', message: 'x', reason_code: 'appointment', errors: { blocked_until: ['2026-11-28T03:00:00Z'] } } as never))
      .mockResolvedValueOnce({ ...triaged, status: 'CALLED' });

    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Call A-01' }));

    expect(await screen.findByText('Call during a protected time?')).toBeTruthy();
    expect(screen.getByText(/Appointment times are protected unless the clinic prioritises an urgent patient/)).toBeTruthy();
    expect(screen.getByText(/This queue is not an emergency service/)).toBeTruthy();
    expect(mocked.callEntry).toHaveBeenCalledTimes(1);
    expect(mocked.callEntry.mock.calls[0][2]).toBeNull();

    await tap(screen.getByRole('button', { name: 'Call A-01 with override' }));
    await waitFor(() => expect(mocked.callEntry).toHaveBeenCalledTimes(2));
    expect(mocked.callEntry.mock.calls[1][0]).toBe('e1');
    expect(mocked.callEntry.mock.calls[1][2]).toBe('PREGNANT');
    expect(mocked.callEntry.mock.calls[1][1]).not.toBe(mocked.callEntry.mock.calls[0][1]);
  });

  it('offers no override for a patient who is not triaged; the refusal copy stands alone', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'e2', label: 'A-02' })]));
    mocked.callEntry.mockRejectedValueOnce(new WalkInError(409, { code: 'APPOINTMENT_WINDOW_PROTECTED', message: 'x', reason_code: 'appointment' } as never));
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Call A-02' }));
    expect(await screen.findByText(/Appointment times are protected/)).toBeTruthy();
    expect(screen.queryByText('Call during a protected time?')).toBeNull();
  });

  it('"Do not call" closes the confirm step without a write', async () => {
    const triaged = entry({ id: 'e3', label: 'A-03', priority_level: 'PRIORITY', priority_reason_code: 'SENIOR_PWD' });
    mocked.fetchBoard.mockResolvedValue(board([triaged]));
    mocked.callEntry.mockRejectedValueOnce(new WalkInError(409, { code: 'APPOINTMENT_WINDOW_PROTECTED', message: 'x', reason_code: 'hold' } as never));
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Call A-03' }));
    await tap(await screen.findByRole('button', { name: 'Do not call' }));
    await waitFor(() => expect(screen.queryByText('Call during a protected time?')).toBeNull());
    expect(mocked.callEntry).toHaveBeenCalledTimes(1);
  });
});

describe('pause and open the queue', () => {
  it('an open queue offers Pause; tapping it sends no key and refetches the board', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'p1', label: 'A-20' })]));
    mocked.pauseQueue.mockResolvedValue({});
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Pause new walk-ins' }));

    await waitFor(() => expect(mocked.pauseQueue).toHaveBeenCalledTimes(1));
    expect(mocked.pauseQueue).toHaveBeenCalledWith('q1');
    expect(mocked.fetchBoard.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: 'Open for new walk-ins' })).toBeNull();
  });

  it('a paused queue shows the calls-still-work copy, offers Open, and keeps Call next enabled', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'p2', label: 'A-21' })], 'PAUSED'));
    mocked.openQueue.mockResolvedValue({});
    mocked.callNext.mockResolvedValue({});
    await renderScreen();

    expect(await screen.findByText(PAUSED_COPY)).toBeTruthy();
    expect(screen.queryByText('Calls resume when the clinic reopens it.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause new walk-ins' })).toBeNull();

    await tap(await screen.findByRole('button', { name: 'Call next patient' }));
    await waitFor(() => expect(mocked.callNext).toHaveBeenCalledTimes(1));

    await tap(screen.getByRole('button', { name: 'Open for new walk-ins' }));
    await waitFor(() => expect(mocked.openQueue).toHaveBeenCalledWith('q1'));
  });

  it('a repeat answered 409 INVALID_STATE_TRANSITION shows the refresh copy', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'p3', label: 'A-22' })]));
    mocked.pauseQueue.mockRejectedValueOnce(new WalkInError(409, { code: 'INVALID_STATE_TRANSITION', message: 'x' } as never));
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Pause new walk-ins' }));
    expect(await screen.findByText('That action no longer applies. The list has been refreshed.')).toBeTruthy();
  });

  it('a closed queue offers neither pause nor open', async () => {
    mocked.fetchBoard.mockResolvedValue(board([], 'CLOSED'));
    await renderScreen();
    expect(await screen.findByText('This queue is closed for today.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pause new walk-ins' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open for new walk-ins' })).toBeNull();
  });
});

describe('idempotency keys on a retry', () => {
  it('a network failure keeps the key, so the retry replays the same Idempotency-Key', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'k1', label: 'A-30', status: 'CALLED' })]));
    mocked.recallEntry.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce({});
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Recall A-30' }));
    await waitFor(() => expect(mocked.recallEntry).toHaveBeenCalledTimes(1));
    await tap(screen.getByRole('button', { name: 'Recall A-30' }));
    await waitFor(() => expect(mocked.recallEntry).toHaveBeenCalledTimes(2));
    expect(mocked.recallEntry.mock.calls[1][1]).toBe(mocked.recallEntry.mock.calls[0][1]);
  });

  it('a final server answer (409 CONCURRENT_MODIFICATION) sends a fresh key on the next tap', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'k2', label: 'A-31', status: 'CALLED' })]));
    mocked.recallEntry
      .mockRejectedValueOnce(new WalkInError(409, { code: 'CONCURRENT_MODIFICATION', message: 'x' } as never))
      .mockResolvedValueOnce({});
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Recall A-31' }));
    await waitFor(() => expect(mocked.recallEntry).toHaveBeenCalledTimes(1));
    await tap(screen.getByRole('button', { name: 'Recall A-31' }));
    await waitFor(() => expect(mocked.recallEntry).toHaveBeenCalledTimes(2));
    expect(mocked.recallEntry.mock.calls[1][1]).not.toBe(mocked.recallEntry.mock.calls[0][1]);
  });

  it('IDEMPOTENCY_IN_PROGRESS is not final: the key is kept, the board is refetched, and the retry replays it', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'k3', label: 'A-32', status: 'CALLED' })]));
    mocked.recallEntry
      .mockRejectedValueOnce(new WalkInError(409, { code: 'IDEMPOTENCY_IN_PROGRESS', message: 'x' } as never))
      .mockResolvedValueOnce({});
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Recall A-32' }));
    expect(await screen.findByText(/still going through/)).toBeTruthy();
    await waitFor(() => expect(mocked.fetchBoard.mock.calls.length).toBeGreaterThanOrEqual(2));
    await tap(screen.getByRole('button', { name: 'Recall A-32' }));
    await waitFor(() => expect(mocked.recallEntry).toHaveBeenCalledTimes(2));
    expect(mocked.recallEntry.mock.calls[1][1]).toBe(mocked.recallEntry.mock.calls[0][1]);
  });
});

describe('priority dialog', () => {
  it('states that priority is not a clinical triage decision (D-G)', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'e10', label: 'A-10', status: 'SKIPPED' })]));
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Change priority for A-10' }));
    expect(await screen.findByText(/It is not a clinical triage decision\./)).toBeTruthy();
  });

  it('has no free-text field and sends the level with a reason code only', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'e4', label: 'A-04', status: 'SKIPPED' })]));
    mocked.setEntryPriority.mockResolvedValue({});
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Change priority for A-04' }));

    expect(await screen.findByText('Priority for A-04')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();

    await tap(screen.getByRole('radio', { name: 'Urgent' }));
    await tap(await screen.findByRole('radio', { name: 'Doctor requested' }));
    await tap(screen.getByRole('button', { name: 'Save priority' }));
    await waitFor(() => expect(mocked.setEntryPriority).toHaveBeenCalledTimes(1));
    expect(mocked.setEntryPriority.mock.calls[0].slice(0, 4)).toEqual(['e4', expect.any(String), 'URGENT', 'DOCTOR_REQUEST']);
  });

  it('refuses to save a priority above normal with no reason', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'e5', label: 'A-05', status: 'SKIPPED' })]));
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Change priority for A-05' }));
    await tap(await screen.findByRole('radio', { name: 'Priority' }));
    await tap(await screen.findByRole('button', { name: 'Save priority' }));
    expect(await screen.findByText('Choose a reason for a priority above normal.')).toBeTruthy();
    expect(mocked.setEntryPriority).not.toHaveBeenCalled();
  });
});

describe('consultation controls', () => {
  it('an interrupted consultation offers Resume and End, not Interrupt, and says check-out waits', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'e6', label: 'A-06', status: 'IN_CONSULTATION', consultation_id: 'c6' })]));
    mocked.fetchConsultation.mockResolvedValue({ id: 'c6', status: 'INTERRUPTED', walkin_queue_entry_id: 'e6' });
    await renderScreen();
    expect(await screen.findByRole('button', { name: 'Resume consultation with A-06' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'End consultation with A-06' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Interrupt consultation with A-06' })).toBeNull();
    expect(screen.getByText(/Check-out waits until it ends/)).toBeTruthy();
  });

  it('a running consultation offers Interrupt and End', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'e7', label: 'A-07', status: 'IN_CONSULTATION', consultation_id: 'c7' })]));
    mocked.fetchConsultation.mockResolvedValue({ id: 'c7', status: 'IN_PROGRESS', walkin_queue_entry_id: 'e7' });
    await renderScreen();
    expect(await screen.findByRole('button', { name: 'Interrupt consultation with A-07' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resume consultation with A-07' })).toBeNull();
  });

  it('when the consultation status cannot be read, no consultation action is offered and the row says so', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'e8', label: 'A-08', status: 'IN_CONSULTATION', consultation_id: 'c8' })]));
    mocked.fetchConsultation.mockRejectedValue(new TypeError('offline'));
    await renderScreen();
    expect(await screen.findByText(/Consultation status could not be read/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /consultation with A-08/ })).toBeNull();
  });
});

describe('error copy on a refused call', () => {
  it('DOCTOR_NOT_AVAILABLE on_break shows the server-reason line, not the raw code', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'e9', label: 'A-09' })]));
    mocked.callEntry.mockRejectedValueOnce(new WalkInError(409, { code: 'DOCTOR_NOT_AVAILABLE', message: 'x', reason_code: 'on_break' } as never));
    await renderScreen();
    await tap(await screen.findByRole('button', { name: 'Call A-09' }));
    expect(await screen.findByText('End your break first.')).toBeTruthy();
    expect(screen.queryByText(/DOCTOR_NOT_AVAILABLE/)).toBeNull();
  });

  it('an empty queue shows the empty line', async () => {
    mocked.fetchBoard.mockResolvedValue(board([]));
    await renderScreen();
    expect(await screen.findByText('No one is in this queue today.')).toBeTruthy();
  });

  it('a refused call-next shows the copy for its reason', async () => {
    mocked.fetchBoard.mockResolvedValue(board([entry({ id: 'w1', label: 'A-10' })]));
    mocked.callNext.mockRejectedValueOnce(new WalkInError(409, { code: 'QUEUE_CLOSED', message: 'x', reason_code: 'paused' } as never));
    await renderScreen();
    await act(async () => {
      await tap(await screen.findByRole('button', { name: 'Call next patient' }));
    });
    expect(await screen.findByText('This queue is paused: no new walk-ins can join. Calls still work.')).toBeTruthy();
  });
});
