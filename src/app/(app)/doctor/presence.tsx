import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Notice, Screen, StateView } from '@/components/ui';
import { BreakDialog } from '@/features/presence/BreakDialog';
import { presenceErrorMessage } from '@/features/presence/copy';
import { formatManilaTime, formatShift } from '@/features/presence/format';
import { presenceKeys, useDoctorDay, useOffline, usePresenceState } from '@/features/presence/hooks';
import { endBreak, markAvailable, markUnavailable, startBreak, type DayLocation } from '@/features/presence/api';
import { statusLabel, transitionOffers } from '@/features/presence/status';
import { useRealtimeStatus } from '@/features/realtime/RealtimeProvider';
import { useRefetchOnFocus } from '@/features/realtime/useRefetchOnFocus';
import { ApiError } from '@mediconnect/api-client';
import { fieldErrors } from '@/lib/errors';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

type Step = 'endBreak' | 'markUnavailable' | 'markAvailable';

/** The doctor's clinic day: status, break and away actions, and today's shifts per clinic. */
export default function ClinicDay() {
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const presence = usePresenceState();
  const day = useDoctorDay();
  const { refetch: refetchPresence } = presence;
  const { refetch: refetchDay } = day;
  const { live, statusChanged, clearStatusChanged } = useRealtimeStatus();
  const offline = useOffline();
  const [breaking, setBreaking] = useState(false);
  // Read once per mount: the covering scheduled break and its suggested length are advisory.
  const [mountedAt] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [breakError, setBreakError] = useState<string | undefined>();
  // Set when the server refuses the scheduled break: the next attempt starts without it.
  const [dropScheduledBreak, setDropScheduledBreak] = useState(false);

  const refetchAll = useCallback(() => {
    void refetchPresence();
    void refetchDay();
  }, [refetchPresence, refetchDay]);
  useRefetchOnFocus(refetchAll);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: presenceKeys.me });
    void queryClient.invalidateQueries({ queryKey: presenceKeys.day });
  };

  const step = useMutation({
    mutationFn: (name: Step) => (name === 'endBreak' ? endBreak() : name === 'markUnavailable' ? markUnavailable() : markAvailable()),
    onSuccess: () => {
      setNotice(null);
      invalidate();
    },
    onError: (error) => {
      setNotice(presenceErrorMessage(error));
      if (error instanceof ApiError && error.code === 'INVALID_STATE_TRANSITION') invalidate();
    },
  });

  const breakStart = useMutation({
    mutationFn: ({ minutes, scheduledBreakId }: { minutes: number; scheduledBreakId: string | null }) => startBreak(minutes, scheduledBreakId),
    onSuccess: () => {
      setBreaking(false);
      setBreakError(undefined);
      setDropScheduledBreak(false);
      setNotice(null);
      invalidate();
    },
    onError: (error) => {
      // Field errors stay in the dialog, so the doctor can fix the length and retry.
      if (error instanceof ApiError && error.status === 422) {
        const fields = fieldErrors(error);
        if (fields.scheduled_break_id) {
          setDropScheduledBreak(true);
          setBreakError('That scheduled break is not at this clinic. Enter the length yourself and start again.');
          return;
        }
        if (fields.expected_minutes) {
          setBreakError('Enter a whole number of minutes from 1 to 240.');
          return;
        }
      }
      setNotice(presenceErrorMessage(error));
      if (error instanceof ApiError && error.code === 'INVALID_STATE_TRANSITION') invalidate();
    },
  });

  if (presence.isPending || day.isPending) {
    return (
      <Screen title="Clinic day">
        <StateView state="loading" message="Loading your clinic day" />
      </Screen>
    );
  }
  if (presence.isError || day.isError) {
    const error = presence.error ?? day.error;
    return (
      <Screen title="Clinic day">
        <StateView state="error" message={presenceErrorMessage(error)} onRetry={refetchAll} />
      </Screen>
    );
  }

  const p = presence.data;
  const offers = transitionOffers(p.status, p.effective_status);
  // Only the checked-in location counts: a scheduled break at another clinic is refused by the server.
  const location: DayLocation | undefined = day.data.locations.find((l) => l.clinic_location_id === p.clinic_location_id);
  const busy = step.isPending || breakStart.isPending;
  const writesDisabled = offline || busy;
  const coveringBreak = (location?.scheduled_breaks ?? []).find(
    (b) => Date.parse(b.starts_at) <= mountedAt && mountedAt < Date.parse(b.ends_at),
  );
  const suggested = coveringBreak ? Math.max(1, Math.round((Date.parse(coveringBreak.ends_at) - mountedAt) / 60000)) : undefined;

  return (
    <Screen title="Clinic day" subtitle={day.data.local_date ? `Today, ${day.data.local_date} (Manila time)` : undefined}>
      {!live ? <Notice tone="info" message="Updates paused. Use Refresh to check again." /> : null}
      {statusChanged ? (
        <>
          <Notice tone="warning" message="Your clinic status was changed. Use Refresh to see it." />
          <Button label="Dismiss the status notice" variant="secondary" onPress={clearStatusChanged} />
        </>
      ) : null}
      {notice ? <Notice tone="error" message={notice} /> : null}

      <Card title="Your status">
        <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.status}>
          {statusLabel(p.effective_status)}
        </Text>
        {p.status === 'NOT_CHECKED_IN' ? (
          <Text style={styles.body}>You are not checked in. Check in at a clinic to start taking walk-ins.</Text>
        ) : (
          <Text style={styles.body}>
            Checked in{location ? ` at ${location.location_name}` : ''} at {formatManilaTime(p.checked_in_at)}.
          </Text>
        )}
        {p.status === 'ON_BREAK' && p.break_expected_end_at ? (
          <Text style={styles.meta}>Break expected to end around {formatManilaTime(p.break_expected_end_at)}. This is an expectation, not a promise.</Text>
        ) : null}
        {p.effective_status === 'BUSY' ? <Text style={styles.meta}>Break and away are unavailable during a consultation.</Text> : null}

        {offers.checkIn ? <Button label="Check in" onPress={() => router.push('/doctor/check-in')} disabled={offline} /> : null}
        {offers.startBreak && !breaking ? (
          <Button
            label="Start a break"
            variant="secondary"
            onPress={() => {
              setBreakError(undefined);
              setBreaking(true);
            }}
            disabled={writesDisabled}
          />
        ) : null}
        {breaking ? (
          <BreakDialog
            suggestedMinutes={suggested}
            busy={breakStart.isPending}
            disabled={writesDisabled}
            serverError={breakError}
            onStart={(minutes) =>
              breakStart.mutate({ minutes, scheduledBreakId: dropScheduledBreak ? null : (coveringBreak?.id ?? null) })
            }
            onCancel={() => {
              setBreaking(false);
              setBreakError(undefined);
              setDropScheduledBreak(false);
            }}
          />
        ) : null}
        {offers.endBreak ? <Button label="End break" onPress={() => step.mutate('endBreak')} loading={step.isPending && step.variables === 'endBreak'} disabled={writesDisabled} /> : null}
        {offers.markAway ? <Button label="Mark away" variant="secondary" onPress={() => step.mutate('markUnavailable')} disabled={writesDisabled} /> : null}
        {offers.markAvailable ? <Button label="Mark available" onPress={() => step.mutate('markAvailable')} disabled={writesDisabled} /> : null}
        {offers.checkOut ? (
          <Button label="Check out" variant="secondary" onPress={() => router.push('/doctor/check-out')} disabled={offline} />
        ) : null}
      </Card>

      <Button label="Refresh" variant="secondary" onPress={refetchAll} />

      <Card title="Today's clinic shifts">
        {day.data.locations.length === 0 ? (
          <StateView state="empty" message="You have no active clinic assignments, so there are no shifts to show." />
        ) : (
          day.data.locations.map((l) => (
            <View key={l.clinic_location_id} style={styles.location}>
              <Text style={styles.label}>{l.location_name}</Text>
              {l.shifts.length === 0 ? (
                <Text style={styles.meta}>No shift today.</Text>
              ) : (
                l.shifts.map((s) => (
                  <Text key={s.starts_at} style={styles.meta}>
                    {formatShift(s.starts_at, s.ends_at)} · {s.service_mode.replace(/_/g, ' ').toLowerCase()}
                  </Text>
                ))
              )}
              {l.scheduled_breaks.map((b) => (
                <Text key={b.id} style={styles.meta}>Scheduled break {formatShift(b.starts_at, b.ends_at)}</Text>
              ))}
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    status: { ...typography.title, color: c.textPrimary },
    body: { ...typography.body, color: c.textPrimary },
    label: { ...typography.label, color: c.textPrimary },
    meta: { ...typography.small, color: c.textMuted },
    location: { gap: space[1], paddingTop: space[2] },
  });
