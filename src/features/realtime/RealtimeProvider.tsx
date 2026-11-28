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
  /** True only while the socket is connected AND no channel was refused. Without it, the app polls. */
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

/** Query keys the doctor screens share, refetched on reconnect, foreground and hints. */
const DOCTOR_DATA_PREFIXES = [presenceKeys.me, presenceKeys.day, presenceKeys.previewPrefix, ['walkin-board']] as const;

/** Held walk-in board versions per queue (queue_version is per queue, and queues are per day). Written by the queue screen. */
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
  const [generation, setGeneration] = useState(0);
  const [statusChanged, setStatusChanged] = useState(false);
  const lastReauth = useRef(0);

  useEffect(() => {
    if (!isDoctor || !userId || !doctorProfileId) return;

    const reauthorise = () => {
      const now = Date.now();
      if (now - lastReauth.current < REAUTH_COOLDOWN_MS) return;
      lastReauth.current = now;
      // The access token is stale: the session check decides. A real 401 signs out; otherwise rebuild the socket.
      fetchMe().then(
        () => setGeneration((g) => g + 1),
        (error: unknown) => {
          if (error instanceof ApiError && error.status === 401) void session.signOut('expired');
        },
      );
    };

    const client: RealtimeClient | null = createAppRealtime({
      // Status only, never the channel detail: a 403 (no ACTIVE assignment) stays quiet and keeps polling.
      onSubscriptionError: (_channel, status) => {
        setRefused(true);
        if (status === 401) reauthorise();
      },
    });
    // No client (Reverb not configured): the initial 'unavailable' state stands and polling applies.
    if (!client) return;

    setRefused(false);
    const stops: (() => void)[] = [];
    let last: RealtimeConnectionState | null = null;
    let everConnected = false;

    const cleanup = () => {
      for (const stop of stops) stop();
      heldBoardVersions.clear();
      client.disconnect();
      setState('unavailable');
    };

    stops.push(
      client.onConnectionChange((next) => {
        const before = last;
        last = next;
        setState(next);
        if (next === 'connected') {
          // Reconnect: whatever changed while the socket was down is fetched again. The first connect needs no refetch.
          if (everConnected && before !== 'connected') invalidateDoctorData(queryClient);
          everConnected = true;
        }
      }),
    );

    try {
      stops.push(
        client.subscribe(`user.${userId}`, ['NotificationCreated'], (_event, hint) => {
          if (STATUS_CHANGED_NOTICE_TYPES.has(hint.type)) setStatusChanged(true);
          invalidateDoctorData(queryClient);
        }),
      );
      stops.push(
        client.subscribe(`doctor.${doctorProfileId}`, ['WalkInRegistered', 'WalkInQueueUpdated'], (_event, hint) => {
          const held = heldBoardVersions.get(hint.queue_id);
          if (shouldRefetch(held, hint.queue_version)) {
            void queryClient.invalidateQueries({ queryKey: ['walkin-board'] });
          }
        }),
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
    // Live means connected and every subscription authorised (no refusal since this socket was built).
    const live = state === 'connected' && !refused;
    return {
      live,
      refetchInterval: refetchIntervalFor(live),
      statusChanged,
      clearStatusChanged: () => setStatusChanged(false),
    };
  }, [state, refused, statusChanged]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext);
}
