import { useQuery } from '@tanstack/react-query';
import { useRealtimeStatus } from '@/features/realtime/RealtimeProvider';
import { fetchBoard, fetchConsultation } from './api';
import { walkinKeys } from './keys';

/** The doctor's own queues at one location, polling only while the socket is not live. Held in memory only. */
export function useBoard(clinicLocationId: string | null | undefined, doctorId: string | null | undefined) {
  const { refetchInterval } = useRealtimeStatus();
  return useQuery({
    queryKey: walkinKeys.board(clinicLocationId ?? '', doctorId ?? ''),
    queryFn: () => fetchBoard(clinicLocationId as string, doctorId as string),
    enabled: Boolean(clinicLocationId && doctorId),
    refetchInterval,
  });
}

/** The running consultation, read for its status (running or interrupted). Interrupt and resume send no hint. */
export function useConsultation(consultationId: string | null | undefined) {
  return useQuery({
    queryKey: walkinKeys.consultation(consultationId ?? ''),
    queryFn: () => fetchConsultation(consultationId as string),
    enabled: Boolean(consultationId),
  });
}
