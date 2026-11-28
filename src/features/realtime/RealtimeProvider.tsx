import { ApiError } from '@mediconnect/api-client';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { RealtimeClient, RealtimeConnectionState } from '@mediconnect/api-client/realtime';
import { fetchMe } from '@/features/auth/api';
import { fetchMyDoctorProfile } from '@/features/doctors/api';
import { presenceKeys } from '@/features/presence/keys';
import { session } from '@/lib/api';
import { createAppRealtime } from '@/lib/realtime';
import { refetchIntervalFor, shouldRefetch, STATUS_CHANGED_NOTICE_TYPES } from './refetch';

interface RealtimeStatus {
  /** True only while the socket is connected, no channel was refused, and every channel is confirmed by the server. Without it, the app polls. */
  live: boolean;
  /** Pass to a query's refetchInterval: 30 s while paused, off while live. */
  refetchInterval: number | false;
  /** A generic notice that the clinic changed the doctor's status. The screen offers Refresh; no detail. */
  statusChanged: boolean;
  clearStatusChanged: () => void;
}

const RealtimeContext = createContext<RealtimeStatus>({
  live: false,
  refetchInterval: refetchIntervalFor(false),
  statusChanged: false,
  clearStatusChanged: () => {},
});

/** A 401 on channel auth re-checks the session at most once per this window (no retry loop). */
const REAUTH_COOLDOWN_MS = 60_000;

/** The user channel and the doctor channel. Live needs both confirmed on the current socket. */
const CHANNEL_COUNT = 2;

/** Query keys the doctor screens share, refetched on reconnect, foreground and hints. */
const DOCTOR_DATA_PREFIXES = [presenceKeys.me, presenceKeys.day, presenceKeys.previewPrefix, ['walkin-board']] as const;

/**
 * Held walk-in board versions per queue (queue_version is per queue, and queues are per day). Written here when a hint
 * triggers a refetch, so an older hint for the same queue is ignored. Cleared on cleanup.
 */
export const heldBoardVersions = new Map<string, number>();

export function invalidateDoctorData(queryClient: QueryClient): void {
  for (const key of DOCTOR_DATA_PREFIXES) {
    void queryClient.invalidateQueries({ queryKey: [...key] });
  }
}

/**
 * Mounted once in the signed-in stack. Active only for a signed-in DOCTOR with a doctor
 * profile. It subscribes to the user channel and the doctor's own channel (names without the
 * client's presence- prefix; the shared helper adds it), and refetches on hints, reconnect and
 * return to the foreground. Hints are never logged.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const isDoctor = me.data?.roles.includes('DOCTOR') ?? false;
  const doctor = useQuery({ queryKey: ['doctor-profile'], queryFn: fetchMyDoctorProfile, enabled: isDoctor });
  const userId = me.data?.id;
  const doctorProfileId = doctor.data?.id;

  const [state, setState] = useState<RealtimeConnectionState>('unavailable');
  const [refused, setRefused] = useState(false);
  const [confirmed, setConfirmed] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [statusChanged, setStatusChanged] = useState(false);
  const lastReauth = useRef(0);

  useEffect(() => {
    if (!isDoctor || !userId || !doctorProfileId) return;

    let disposed = false;
    const confirmedChannels = new Set<string>();

    const reauthorise = () => {
      const now = Date.now();
      if (now - lastReauth.current < REAUTH_COOLDOWN_MS) return;
      lastReauth.current = now;
      // The access token is stale: the session check decides, then the socket is rebuilt.
      fetchMe().then(
        () => setGeneration((g) => g + 1),
        (error: unknown) => {
          // Cookie mode only. In token mode SessionManager owns the decision: a transient refresh failure
          // (429, 5xx, offline) keeps the session, and a refused refresh has already signed out.
          if (session.mode === 'cookie' && error instanceof ApiError && error.status === 401) void session.signOut('expired');
        },
      );
    };

    const client: RealtimeClient | null = createAppRealtime({
      // Status only, never the channel detail: a 403 (no ACTIVE assignment) stays quiet and keeps polling.
      onSubscriptionError: (_channel, status) => {
        if (disposed) return;
        setRefused(true);
        if (status === 401) reauthorise();
      },
    });
    // No client (Reverb not configured): the initial 'unavailable' state stands and polling applies.
    if (!client) return;

    setRefused(false);
    setConfirmed(0);
    const stops: (() => void)[] = [];
    let last: RealtimeConnectionState | null = null;
    let everConnected = false;

    const cleanup = () => {
      disposed = true;
      for (const stop of stops) stop();
      heldBoardVersions.clear();
      client.disconnect();
      setState('unavailable');
      setConfirmed(0);
    };

    const confirm = (channel: string) => () => {
      if (disposed) return;
      confirmedChannels.add(channel);
      setConfirmed(confirmedChannels.size);
    };

    stops.push(
      client.onConnectionChange((next) => {
        const before = last;
        last = next;
        setState(next);
        if (next !== 'connected') {
          // pusher-js re-subscribes after a reconnect, and each channel is confirmed again before it counts as live.
          confirmedChannels.clear();
          setConfirmed(0);
          return;
        }
        // Reconnect: whatever changed while the socket was down is fetched again. The first connect needs no refetch.
        if (everConnected && before !== 'connected') invalidateDoctorData(queryClient);
        everConnected = true;
      }),
    );

    try {
      const userChannel = `user.${userId}`;
      stops.push(
        client.subscribe(
          userChannel,
          ['NotificationCreated'],
          (_event, hint) => {
            if (STATUS_CHANGED_NOTICE_TYPES.has(hint.type)) setStatusChanged(true);
            invalidateDoctorData(queryClient);
          },
          confirm(userChannel),
        ),
      );
      const doctorChannel = `doctor.${doctorProfileId}`;
      stops.push(
        client.subscribe(
          doctorChannel,
          ['WalkInRegistered', 'WalkInQueueUpdated'],
          (_event, hint) => {
            const held = heldBoardVersions.get(hint.queue_id);
            if (shouldRefetch(held, hint.queue_version)) {
              heldBoardVersions.set(hint.queue_id, hint.queue_version);
              void queryClient.invalidateQueries({ queryKey: ['walkin-board'] });
            }
          },
          confirm(doctorChannel),
        ),
      );
    } catch (error) {
      // A channel or event that the contract does not allow is a programming error: tidy up, then surface it.
      cleanup();
      throw error;
    }

    return cleanup;
  }, [isDoctor, userId, doctorProfileId, generation, queryClient]);

  // Foreground return: refetch, because a backgrounded socket may have dropped.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') invalidateDoctorData(queryClient);
    });
    return () => subscription.remove();
  }, [queryClient]);

  const value = useMemo<RealtimeStatus>(() => {
    const live = state === 'connected' && !refused && confirmed >= CHANNEL_COUNT;
    return {
      live,
      refetchInterval: refetchIntervalFor(live),
      statusChanged,
      clearStatusChanged: () => setStatusChanged(false),
    };
  }, [state, refused, confirmed, statusChanged]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext);
}
