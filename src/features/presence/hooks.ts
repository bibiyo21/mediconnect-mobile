import { useNetworkState } from 'expo-network';
import { useRealtimeStatus } from '@/features/realtime/RealtimeProvider';
import { useQuery } from '@tanstack/react-query';
import { fetchDay, fetchPresence } from './api';
import { presenceKeys } from './keys';

export { presenceKeys };

/** The doctor's stored + derived presence, polling only while the socket is paused. */
export function usePresenceState() {
  const { refetchInterval } = useRealtimeStatus();
  return useQuery({ queryKey: presenceKeys.me, queryFn: fetchPresence, refetchInterval });
}

/** Today's shifts, breaks and check-in readiness per assignment (server answer; no client rules). */
export function useDoctorDay() {
  const { refetchInterval } = useRealtimeStatus();
  return useQuery({ queryKey: presenceKeys.day, queryFn: fetchDay, refetchInterval });
}

/** True when the device reports no connection. Writes are disabled while offline. */
export function useOffline(): boolean {
  const { isConnected } = useNetworkState();
  return isConnected === false;
}
