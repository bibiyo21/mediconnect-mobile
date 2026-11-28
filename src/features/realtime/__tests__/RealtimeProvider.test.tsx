/**
 * Wiring test for the doctor realtime provider. The shared helper (createRealtime) is real, so its
 * channel-name and event checks run here. The socket transports are faked in jest.setup.ts.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { fetchMe } from '@/features/auth/api';
import { fetchMyDoctorProfile } from '@/features/doctors/api';
import { session } from '@/lib/api';
import { createAppRealtime } from '@/lib/realtime';
import { heldBoardVersions, RealtimeProvider, useRealtimeStatus } from '../RealtimeProvider';

jest.mock('@/features/auth/api', () => ({ fetchMe: jest.fn() }));
jest.mock('@/features/doctors/api', () => ({ fetchMyDoctorProfile: jest.fn() }));
jest.mock('@/lib/api', () => ({ session: { signOut: jest.fn() } }));

// The app's config is not under test: the real helper is built with the same options the app passes.
let mockCapturedOptions: { onSubscriptionError?: (channel: string, status: number) => void } = {};
jest.mock('@/lib/realtime', () => ({
  createAppRealtime: jest.fn((options: { onSubscriptionError?: (channel: string, status: number) => void } = {}) => {
    mockCapturedOptions = options;
    const { createRealtime: real } = jest.requireActual('@mediconnect/api-client/realtime');
    return real({
      appKey: 'test-key',
      wsHost: 'realtime.test',
      scheme: 'https',
      authEndpoint: 'https://api.test/api/v1/broadcasting/auth',
      auth: { mode: 'bearer', getToken: () => 'token' },
      onSubscriptionError: options.onSubscriptionError,
    });
  }),
}));

type Fake = {
  stateHandlers: ((state: { current: string }) => void)[];
  joined: string[];
  listens: { channel: string; event: string; handler: (payload: unknown) => void }[];
  left: string[];
  disconnects: number;
  constructed: number;
};
const fake = (globalThis as unknown as { __realtimeFake: Fake }).__realtimeFake;

const mockedFetchMe = fetchMe as jest.Mock;
const mockedDoctor = fetchMyDoctorProfile as jest.Mock;

function Probe() {
  const { live } = useRealtimeStatus();
  return <Text>{live ? 'live' : 'paused'}</Text>;
}

/** Lets the queries resolve and the effects run inside act. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function setup(roles: string[] = ['DOCTOR']) {
  mockedFetchMe.mockResolvedValue({ id: 'u1', roles });
  mockedDoctor.mockResolvedValue({ id: 'd1' });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  const rendered = await render(
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <Probe />
      </RealtimeProvider>
    </QueryClientProvider>,
  );
  // The doctor profile query starts only after the user query resolves, so wait for the effect to build the socket.
  if (roles.includes('DOCTOR')) await waitFor(() => expect(createAppRealtime).toHaveBeenCalled());
  await settle();
  return { unmount: rendered.unmount, invalidate };
}

async function emitState(current: string) {
  await act(async () => {
    for (const handler of fake.stateHandlers) handler({ current });
  });
}

afterEach(async () => {
  // Unmount each tree and let its effects finish before the next test renders.
  await cleanup();
});

beforeEach(() => {
  fake.stateHandlers.length = 0;
  fake.joined.length = 0;
  fake.listens.length = 0;
  fake.left.length = 0;
  fake.disconnects = 0;
  fake.constructed = 0;
  heldBoardVersions.clear();
  jest.clearAllMocks();
});

describe('RealtimeProvider wiring', () => {
  it('subscribes a doctor to user.{id} and doctor.{id}, with no presence- prefix, and the contract events', async () => {
    await setup();
    expect(fake.joined).toEqual(expect.arrayContaining(['user.u1', 'doctor.d1']));
    expect(fake.joined.some((c) => c.startsWith('presence-'))).toBe(false);
    expect(fake.listens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: 'user.u1', event: '.NotificationCreated' }),
        expect.objectContaining({ channel: 'doctor.d1', event: '.WalkInRegistered' }),
        expect.objectContaining({ channel: 'doctor.d1', event: '.WalkInQueueUpdated' }),
      ]),
    );
  });

  it('never subscribes a user who is not a doctor', async () => {
    await setup(['PATIENT']);
    expect(mockedFetchMe).toHaveBeenCalled();
    expect(createAppRealtime).not.toHaveBeenCalled();
    expect(fake.joined).toEqual([]);
  });

  it('leaves both channels, disconnects and clears held versions on unmount', async () => {
    const { unmount } = await setup();
    heldBoardVersions.set('q1', 3);
    await act(async () => {
      unmount();
    });
    expect(fake.left).toEqual(expect.arrayContaining(['user.u1', 'doctor.d1']));
    expect(fake.disconnects).toBe(1);
    expect(heldBoardVersions.size).toBe(0);
  });

  it('is live only while connected and no channel was refused', async () => {
    await setup();
    await emitState('connected');
    expect(screen.getByText('live')).toBeTruthy();

    await act(async () => mockCapturedOptions.onSubscriptionError?.('private-doctor.d1', 403));
    expect(screen.getByText('paused')).toBeTruthy();
  });

  it('refetches the walk-in board only when the hint version is not older than the held one, per queue', async () => {
    const { invalidate } = await setup();
    heldBoardVersions.set('q1', 5);
    const doctorHandler = fake.listens.find((l) => l.channel === 'doctor.d1' && l.event === '.WalkInQueueUpdated')!.handler;

    invalidate.mockClear();
    await act(async () => doctorHandler({ queue_id: 'q1', queue_version: 4, clinic_location_id: 'loc' }));
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['walkin-board'] });

    await act(async () => doctorHandler({ queue_id: 'q1', queue_version: 5, clinic_location_id: 'loc' }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['walkin-board'] });

    invalidate.mockClear();
    await act(async () => doctorHandler({ queue_id: 'other-queue', queue_version: 1, clinic_location_id: 'loc' }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['walkin-board'] });
  });

  it('on a 401 channel refusal, checks the session and rebuilds the socket once; a second 401 inside the cooldown does not', async () => {
    await setup();
    const before = fake.constructed;

    await act(async () => mockCapturedOptions.onSubscriptionError?.('private-user.u1', 401));
    await waitFor(() => expect(fake.constructed).toBe(before + 1));
    expect(session.signOut).not.toHaveBeenCalled();

    const constructedNow = fake.constructed;
    await act(async () => mockCapturedOptions.onSubscriptionError?.('private-user.u1', 401));
    await settle();
    expect(fake.constructed).toBe(constructedNow);
  });
});
