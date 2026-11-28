/**
 * The doctor's own walk-in queue at the checked-in clinic (increment 5.9-M2). Every action is the server's answer:
 * the app shows what the server allows and refreshes after each write. Board data is held in memory only.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ApiError } from '@mediconnect/api-client';
import { Button, Card, Notice, Screen, StateView } from '@/components/ui';
import { fetchMyDoctorProfile } from '@/features/doctors/api';
import { usePresenceState, useOffline } from '@/features/presence/hooks';
import { useRealtimeStatus } from '@/features/realtime/RealtimeProvider';
import { useRefetchOnFocus } from '@/features/realtime/useRefetchOnFocus';
import { EntryRow } from '@/features/walkins/EntryRow';
import { OverrideConfirm } from '@/features/walkins/OverrideConfirm';
import { PriorityDialog } from '@/features/walkins/PriorityDialog';
import { PRIORITY_REASON_LABELS, protectedWindowText, queueErrorMessage } from '@/features/walkins/copy';
import { useBoard, useConsultation } from '@/features/walkins/hooks';
import { IntentKeys, keepsKey } from '@/features/walkins/idempotency';
import { entryActions, type QueueAction } from '@/features/walkins/queueActions';
import {
  callEntry,
  callNext,
  endConsultation,
  interruptConsultation,
  noShowEntry,
  openQueue,
  pauseQueue,
  recallEntry,
  resumeConsultation,
  returnEntry,
  setEntryPriority,
  skipEntry,
  startConsultation,
  WalkInError,
  type BoardQueue,
  type PriorityLevelName,
  type WalkInEntry,
} from '@/features/walkins/api';
import { walkinKeys } from '@/features/walkins/keys';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** Errors after which the list on screen is stale, so it is read again. */
const REFRESH_CODES = new Set([
  'NOT_NEXT_IN_ORDER',
  'INVALID_STATE_TRANSITION',
  'ENTRY_ALREADY_CALLED',
  'NOT_FOUND',
  'QUEUE_EMPTY',
  'IDEMPOTENCY_IN_PROGRESS',
]);

/** Queue-level writes: no entry, and pause and open carry no Idempotency-Key. */
type QueueLevelAction = 'callNext' | 'pauseQueue' | 'openQueue';

interface Job {
  intent: string;
  action: QueueAction | QueueLevelAction;
  entryId: string | null;
  /** Pause and open: sent without a key. `run` then gets an empty string and ignores it. */
  keyless?: boolean;
  run: (key: string) => Promise<unknown>;
  /** A call that a protected window refuses may be retried as an urgent override, for a triaged patient only. */
  overrideTarget?: WalkInEntry;
  /** Refresh the running consultation after the write (start, end, interrupt, resume). */
  consultationId?: string;
}

/** The queue screen: call, recall, skip, no-show, return, priority, and the consultation start, end, interrupt and resume. */
export default function DoctorQueue() {
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const presence = usePresenceState();
  const doctor = useQuery({ queryKey: ['doctor-profile'], queryFn: fetchMyDoctorProfile });
  const { live } = useRealtimeStatus();
  const offline = useOffline();
  const [keys] = useState(() => new IntentKeys());
  const [notice, setNotice] = useState<string | null>(null);
  const [priorityFor, setPriorityFor] = useState<WalkInEntry | null>(null);
  const [override, setOverride] = useState<{ entry: WalkInEntry; windowText: string } | null>(null);

  const clinicLocationId = presence.data?.clinic_location_id ?? null;
  const doctorId = doctor.data?.id ?? null;
  const board = useBoard(clinicLocationId, doctorId);
  const { refetch: refetchBoard } = board;
  const { refetch: refetchPresence } = presence;

  const queues: BoardQueue[] = board.data?.queues ?? [];
  const running = queues.flatMap((q) => q.entries).find((e) => e.status === 'IN_CONSULTATION');
  const consultation = useConsultation(running?.consultation_id ?? null);
  const { refetch: refetchConsultation } = consultation;
  const runningConsultationId = running?.consultation_id ?? null;
  // Only read the consultation when one is running: with none, the query has no id and the request would 404.
  const refetchAll = useCallback(() => {
    void refetchPresence();
    void refetchBoard();
    if (runningConsultationId) void refetchConsultation();
  }, [refetchPresence, refetchBoard, refetchConsultation, runningConsultationId]);
  useRefetchOnFocus(refetchAll);

  const run = useMutation({
    mutationFn: async (job: Job) => {
      if (job.keyless) return job.run('');
      const key = keys.keyFor(job.intent);
      try {
        const result = await job.run(key);
        keys.settle(job.intent, false);
        return result;
      } catch (error) {
        // Keep the key while the answer is not final: a network failure may have reached the server, and
        // IDEMPOTENCY_IN_PROGRESS means the first request is still running. The retry replays the same key.
        keys.settle(job.intent, keepsKey(error));
        throw error;
      }
    },
    onMutate: () => setNotice(null),
    onSuccess: (_result, job) => {
      setPriorityFor(null);
      setOverride(null);
      void queryClient.invalidateQueries({ queryKey: ['walkin-board'] });
      if (job.consultationId) void queryClient.invalidateQueries({ queryKey: walkinKeys.consultation(job.consultationId) });
    },
    onError: (error, job) => {
      setNotice(queueErrorMessage(error));
      if (error instanceof WalkInError && error.code === 'APPOINTMENT_WINDOW_PROTECTED' && job.overrideTarget && job.overrideTarget.priority_level !== 'NORMAL') {
        setOverride({ entry: job.overrideTarget, windowText: protectedWindowText(error) });
      }
      if (error instanceof ApiError && REFRESH_CODES.has(error.code)) void refetchBoard();
    },
  });

  const writesDisabled = offline || run.isPending;
  const pendingEntryId = run.isPending ? (run.variables?.entryId ?? null) : null;
  const pendingAction = run.isPending ? (run.variables?.action ?? null) : null;
  // The row spinner covers entry actions only; call-next has its own spinner on the queue card.
  const rowPendingAction = entryActionOf(pendingAction);

  function onQueueControl(queue: BoardQueue, action: 'pauseQueue' | 'openQueue') {
    const intent = `${action === 'pauseQueue' ? 'pause' : 'open'}:${queue.id}`;
    run.mutate({ intent, action, entryId: null, keyless: true, run: () => (action === 'pauseQueue' ? pauseQueue(queue.id) : openQueue(queue.id)) });
  }

  function onEntryAction(entry: WalkInEntry, action: QueueAction) {
    switch (action) {
      case 'call':
        return run.mutate({ intent: `call:${entry.id}`, action, entryId: entry.id, run: (k) => callEntry(entry.id, k, null), overrideTarget: entry });
      case 'recall':
        return run.mutate({ intent: `recall:${entry.id}`, action, entryId: entry.id, run: (k) => recallEntry(entry.id, k) });
      case 'skip':
        return run.mutate({ intent: `skip:${entry.id}`, action, entryId: entry.id, run: (k) => skipEntry(entry.id, k) });
      case 'noShow':
        return run.mutate({ intent: `no-show:${entry.id}`, action, entryId: entry.id, run: (k) => noShowEntry(entry.id, k) });
      case 'return':
        return run.mutate({ intent: `return:${entry.id}`, action, entryId: entry.id, run: (k) => returnEntry(entry.id, k) });
      case 'priority':
        setNotice(null);
        return setPriorityFor(entry);
      case 'startConsultation': {
        const cid = entry.consultation_id as string;
        return run.mutate({ intent: `start:${cid}`, action, entryId: entry.id, run: (k) => startConsultation(cid, k), consultationId: cid });
      }
      case 'endConsultation':
      case 'interrupt':
      case 'resume': {
        const cid = entry.consultation_id as string;
        const call = action === 'endConsultation' ? endConsultation : action === 'interrupt' ? interruptConsultation : resumeConsultation;
        return run.mutate({ intent: `${action}:${cid}`, action, entryId: entry.id, run: (k) => call(cid, k), consultationId: cid });
      }
    }
  }

  function onCallNext(queue: BoardQueue) {
    const head = queue.entries.find((e) => e.status === 'WAITING');
    run.mutate({ intent: `call-next:${queue.id}`, action: 'callNext', entryId: null, run: (k) => callNext(queue.id, k), overrideTarget: head });
  }

  if (presence.isPending || doctor.isPending || (clinicLocationId !== null && board.isPending)) {
    return (
      <Screen title="Walk-in queue">
        <StateView state="loading" message="Loading your walk-in queue" />
      </Screen>
    );
  }
  if (presence.isError || doctor.isError) {
    return (
      <Screen title="Walk-in queue">
        <StateView state="error" message={queueErrorMessage(presence.error ?? doctor.error)} onRetry={refetchAll} />
      </Screen>
    );
  }
  if (!clinicLocationId) {
    return (
      <Screen title="Walk-in queue">
        <StateView state="empty" message="Check in at a clinic to see your walk-in queue." />
        <Button label="Go to clinic day" variant="secondary" onPress={() => router.push('/doctor/presence')} />
      </Screen>
    );
  }
  if (board.isError) {
    return (
      <Screen title="Walk-in queue">
        <StateView state="error" message={queueErrorMessage(board.error)} onRetry={refetchAll} />
      </Screen>
    );
  }

  const subtitle = board.data ? `Today, ${board.data.local_date} (Manila time)` : undefined;

  return (
    <Screen title="Walk-in queue" subtitle={subtitle}>
      {offline ? <Notice tone="warning" message="You are offline. Queue actions are paused until you reconnect." /> : null}
      {!live ? (
        <>
          <Notice tone="info" message="Updates paused. This list may be out of date. Refresh before you call." />
          <Button label="Refresh" variant="secondary" onPress={refetchAll} />
        </>
      ) : null}
      {notice ? <Notice tone="error" message={notice} /> : null}

      {override ? (
        <OverrideConfirm
          key={override.entry.id}
          label={override.entry.label}
          windowText={override.windowText}
          queueReasonLabel={override.entry.priority_reason_code ? PRIORITY_REASON_LABELS[override.entry.priority_reason_code] : null}
          busy={run.isPending}
          disabled={offline}
          onConfirm={(reason) =>
            run.mutate({ intent: `override:${override.entry.id}:${reason}`, action: 'call', entryId: override.entry.id, run: (k) => callEntry(override.entry.id, k, reason) })
          }
          onCancel={() => setOverride(null)}
        />
      ) : null}

      {priorityFor ? (
        <PriorityDialog
          label={priorityFor.label}
          current={priorityFor.priority_level as PriorityLevelName}
          busy={run.isPending}
          disabled={offline}
          onSave={(level, reason) =>
            run.mutate({
              intent: `priority:${priorityFor.id}:${level}:${reason ?? ''}`,
              action: 'priority',
              entryId: priorityFor.id,
              run: (k) => setEntryPriority(priorityFor.id, k, level, reason),
            })
          }
          onCancel={() => setPriorityFor(null)}
        />
      ) : null}

      {board.isFetching && !board.isPending ? <Text style={styles.meta}>Refreshing the list…</Text> : null}

      {queues.length === 0 ? (
        <StateView state="empty" message="You have no walk-in queue at this clinic today." />
      ) : (
        queues.map((queue) => {
          const waiting = queue.entries.filter((e) => e.status === 'WAITING');
          const firstWaitingId = waiting[0]?.id ?? null;
          const now = queue.entries.filter((e) => e.status === 'CALLED' || e.status === 'IN_CONSULTATION');
          const skipped = queue.entries.filter((e) => e.status === 'SKIPPED');
          const notArrived = queue.entries.filter((e) => e.status === 'REGISTERED').length;
          const callNextDisabled = writesDisabled || waiting.length === 0 || queue.status === 'CLOSED';

          return (
            <Card key={queue.id} title={`Your queue · ${queue.status.toLowerCase()}`}>
              <Text style={styles.meta}>
                {waiting.length} waiting · {notArrived} not arrived · {skipped.length} skipped
              </Text>
              {queue.status === 'PAUSED' ? (
                <Notice tone="info" message="This queue is paused: no new walk-ins can join. You can still call patients already in it." />
              ) : null}
              {queue.status === 'CLOSED' ? <Notice tone="info" message="This queue is closed for today." /> : null}
              <Button
                label="Call next patient"
                onPress={() => onCallNext(queue)}
                loading={pendingAction === 'callNext' && run.variables?.intent === `call-next:${queue.id}`}
                disabled={callNextDisabled || pendingEntryId !== null}
              />
              {queue.status === 'OPEN' ? (
                <Button
                  label="Pause new walk-ins"
                  variant="secondary"
                  onPress={() => onQueueControl(queue, 'pauseQueue')}
                  loading={run.isPending && run.variables?.intent === `pause:${queue.id}`}
                  disabled={writesDisabled || pendingEntryId !== null}
                />
              ) : null}
              {queue.status === 'PAUSED' ? (
                <Button
                  label="Open for new walk-ins"
                  variant="secondary"
                  onPress={() => onQueueControl(queue, 'openQueue')}
                  loading={run.isPending && run.variables?.intent === `open:${queue.id}`}
                  disabled={writesDisabled || pendingEntryId !== null}
                />
              ) : null}
              {queue.entries.length === 0 ? <StateView state="empty" message="No one is in this queue today." /> : null}

              {now.length > 0 ? <Text style={styles.section}>Now</Text> : null}
              {now.map((entry) => {
                const isRunning = entry.id === running?.id;
                const cStatus = isRunning ? (consultation.data?.status ?? null) : null;
                const note =
                  entry.status === 'IN_CONSULTATION' && isRunning && consultation.isError
                    ? 'Consultation status could not be read. Use Refresh.'
                    : cStatus === 'INTERRUPTED'
                      ? 'Interrupted: resume or end this consultation. Check-out waits until it ends.'
                      : undefined;
                const actions = entryActions(entry, {
                  isFirstWaiting: false,
                  consultationStatus: isRunning ? cStatus : entry.status === 'CALLED' ? undefined : null,
                });
                return (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    actions={actions}
                    consultationNote={note}
                    disabled={writesDisabled}
                    pendingAction={pendingEntryId === entry.id ? rowPendingAction : null}
                    onAction={(action) => onEntryAction(entry, action)}
                  />
                );
              })}

              {waiting.length > 0 ? <Text style={styles.section}>Waiting</Text> : null}
              {waiting.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  actions={entryActions(entry, { isFirstWaiting: entry.id === firstWaitingId })}
                  disabled={writesDisabled}
                  pendingAction={pendingEntryId === entry.id ? rowPendingAction : null}
                  onAction={(action) => onEntryAction(entry, action)}
                />
              ))}

              {skipped.length > 0 ? <Text style={styles.section}>Skipped</Text> : null}
              {skipped.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  actions={entryActions(entry, { isFirstWaiting: false })}
                  disabled={writesDisabled}
                  pendingAction={pendingEntryId === entry.id ? rowPendingAction : null}
                  onAction={(action) => onEntryAction(entry, action)}
                />
              ))}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

/** The entry action behind a pending write, or null for a queue-level write (call next, pause, open). */
function entryActionOf(action: Job['action'] | null): QueueAction | null {
  return action === null || action === 'callNext' || action === 'pauseQueue' || action === 'openQueue' ? null : action;
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    section: { ...typography.label, color: c.textPrimary, paddingTop: space[2] },
    meta: { ...typography.small, color: c.textMuted },
  });

