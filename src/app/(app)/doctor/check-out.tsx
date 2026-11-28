import { ApiError } from '@mediconnect/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useReducer, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChoiceGroup, Checkbox, Notice, Screen, StateView } from '@/components/ui';
import { checkOut, fetchCheckOutPreview, PresenceError, type CheckOutDisposition, type CheckOutReason, type CheckOutResult } from '@/features/presence/api';
import { checkOutBlockText, presenceErrorMessage } from '@/features/presence/copy';
import { buildCheckOutBody, canSubmit, INITIAL_CHECK_OUT, reduceCheckOut } from '@/features/presence/checkOutFlow';
import { presenceKeys, useOffline, usePresenceState } from '@/features/presence/hooks';
import { useRefetchOnFocus } from '@/features/realtime/useRefetchOnFocus';
import { fieldErrors } from '@/lib/errors';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

const STEP_TITLES = ['Check what is open', 'Blocks', 'Reason', 'Walk-ins and confirm'] as const;

const REASONS: { value: CheckOutReason; label: string }[] = [
  { value: 'END_OF_SHIFT', label: 'End of shift' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'CLINIC_CLOSED', label: 'Clinic closed' },
  { value: 'OTHER', label: 'Other' },
];

const DISPOSITIONS: { value: CheckOutDisposition; label: string }[] = [
  { value: 'HOLD_FOR_REASSIGNMENT', label: 'Keep walk-ins waiting for reassignment' },
  { value: 'NOTIFY_AND_CANCEL', label: 'Cancel walk-ins with notice' },
];

/**
 * Four steps: preview, blocks, reason, then walk-in choice and confirmation. No appointment is cancelled silently.
 * A failed submit keeps the doctor's answers, except when the server says the flow is stale.
 */
export default function CheckOut() {
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const offline = useOffline();
  const presence = usePresenceState();
  const locationId = presence.data?.clinic_location_id ?? null;
  const [flow, dispatch] = useReducer(reduceCheckOut, INITIAL_CHECK_OUT);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<CheckOutResult | null>(null);
  // The server says this doctor is already checked out (an earlier POST may have succeeded after a timeout).
  const [alreadyOut, setAlreadyOut] = useState(false);

  const preview = useQuery({
    queryKey: presenceKeys.preview(locationId ?? 'none'),
    queryFn: () => fetchCheckOutPreview(locationId as string),
    enabled: locationId !== null,
  });

  const { refetch: refetchPresence } = presence;
  const { refetch: refetchPreview } = preview;
  const refetchAll = useCallback(() => {
    void refetchPresence();
    if (locationId !== null) void refetchPreview();
  }, [refetchPresence, refetchPreview, locationId]);
  useRefetchOnFocus(refetchAll);

  const guestCount = preview.data?.queues.reduce((sum, q) => sum + q.guest_count, 0) ?? 0;
  const blocked = (preview.data?.blocking.length ?? 0) > 0;

  const submit = useMutation({
    mutationFn: () => checkOut(buildCheckOutBody(flow, guestCount, locationId as string)),
    onSuccess: (data) => {
      setResult(data);
      setNotice(null);
      void queryClient.invalidateQueries({ queryKey: presenceKeys.me });
      void queryClient.invalidateQueries({ queryKey: presenceKeys.day });
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: presenceKeys.me });
      if (error instanceof PresenceError && error.code === 'INVALID_STATE_TRANSITION' && error.reasonCode === 'not_checked_in') {
        // Already out: show that state and do not restart the flow.
        setAlreadyOut(true);
        setNotice(null);
        return;
      }
      if (error instanceof ApiError && error.status === 422 && fieldErrors(error).guests_informed_in_person) {
        // Keep the flow: only the guests checkbox is missing.
        setNotice('Tick "I told the guests in person" to confirm before cancelling.');
        return;
      }
      setNotice(presenceErrorMessage(error));
      // A stale preview (someone else changed the state, or an active consultation started): back to step 1 with a fresh preview.
      const stale = error instanceof ApiError && (error.code === 'ACTIVE_CONSULTATION' || error.code === 'INVALID_STATE_TRANSITION');
      if (stale) {
        dispatch({ type: 'restart' });
        void refetchPreview();
      }
    },
  });

  if (result || alreadyOut) {
    return (
      <Screen title={result ? 'Checked out' : 'You are checked out'}>
        <Card title="Done">
          {result ? (
            <>
              <Text style={styles.body}>You are checked out. Your appointments were not cancelled.</Text>
              <Text style={styles.meta}>Queues paused: {result.result.queues_paused}</Text>
              <Text style={styles.meta}>Walk-ins held: {result.result.entries_held}</Text>
              <Text style={styles.meta}>Walk-ins cancelled with notice: {result.result.entries_cancelled}</Text>
              <Text style={styles.meta}>Appointments flagged for rescheduling: {result.result.appointments_flagged}</Text>
            </>
          ) : (
            <Text style={styles.body}>You are checked out. The clinic day shows your current status and the counts.</Text>
          )}
          <Button label="Back to clinic day" onPress={() => router.dismissTo('/doctor/presence')} />
        </Card>
      </Screen>
    );
  }

  // A disabled preview (no open session) stays pending in TanStack v5: only wait for it when it is enabled.
  if (presence.isPending || (locationId !== null && preview.isPending)) {
    return (
      <Screen title="Check out">
        <StateView state="loading" message="Checking what is open" />
      </Screen>
    );
  }
  if (preview.isError || presence.isError) {
    const error = preview.error ?? presence.error;
    return (
      <Screen title="Check out">
        <StateView state="error" message={presenceErrorMessage(error)} onRetry={refetchAll} />
      </Screen>
    );
  }
  if (!preview.data) {
    return (
      <Screen title="Check out">
        <StateView state="empty" message="You are not checked in, so there is nothing to check out of." />
        <Button label="Back to clinic day" variant="secondary" onPress={() => router.dismissTo('/doctor/presence')} />
      </Screen>
    );
  }

  const p = preview.data;
  const busy = submit.isPending;
  const ready = canSubmit(flow, guestCount);
  const cancelling = flow.disposition === 'NOTIFY_AND_CANCEL';
  const stepLabel = `Step ${flow.step} of 4: ${STEP_TITLES[flow.step - 1]}`;

  return (
    <Screen title="Check out">
      {/* Progress is announced as a value, not only as text. */}
      <Text
        accessibilityRole="progressbar"
        accessibilityLabel={stepLabel}
        accessibilityValue={{ min: 1, max: 4, now: flow.step, text: stepLabel }}
        style={styles.meta}
      >
        {stepLabel}
      </Text>
      {offline ? <Notice tone="warning" message="You are offline. Check-out needs a connection." /> : null}
      {notice ? <Notice tone="error" message={notice} /> : null}
      {presence.data?.status === 'NOT_CHECKED_IN' ? <Notice tone="info" message="You are not checked in. There is nothing to check out of." /> : null}

      {flow.step === 1 ? (
        <Card title="What is open">
          <Text style={styles.body}>
            {p.queues.reduce((n, q) => n + q.counts.waiting + q.counts.registered, 0)} waiting walk-ins ·{' '}
            {p.appointments.count} appointments today
          </Text>
          <Text style={styles.meta}>Counts only. No names are shown here.</Text>
          <Button label="Next" onPress={() => dispatch({ type: 'next', blocked: false })} disabled={offline} />
        </Card>
      ) : null}

      {flow.step === 2 ? (
        <Card title="Blocks">
          {p.blocking.length === 0 ? (
            <Text style={styles.body}>Nothing blocks check-out.</Text>
          ) : (
            p.blocking.map((b, i) => (
              <Notice key={`${b.code}-${i}`} tone="warning" message={checkOutBlockText(b.code, b.reason_code)} />
            ))
          )}
          {blocked ? <Text style={styles.meta}>Finish the item above, then open this screen again to check out.</Text> : null}
          <Button label="Next" onPress={() => dispatch({ type: 'next', blocked })} disabled={blocked || offline} />
          <Button label="Back" variant="secondary" onPress={() => dispatch({ type: 'back' })} />
        </Card>
      ) : null}

      {flow.step === 3 ? (
        <Card title="Reason">
          <ChoiceGroup
            label="Why are you checking out?"
            options={REASONS}
            // No option is selected until the doctor chooses one (the empty value matches none).
            value={(flow.reason ?? '') as CheckOutReason}
            onChange={(reason) => dispatch({ type: 'reason', reason })}
          />
          <Button label="Next" onPress={() => dispatch({ type: 'next', blocked: false })} disabled={flow.reason === null} />
          <Button label="Back" variant="secondary" onPress={() => dispatch({ type: 'back' })} />
        </Card>
      ) : null}

      {flow.step === 4 ? (
        <Card title="Walk-ins and confirm">
          <Text style={styles.body}>
            No appointment is cancelled. {p.appointments.count} appointments will be flagged for rescheduling.
          </Text>
          <ChoiceGroup
            label="What happens to waiting walk-ins?"
            options={DISPOSITIONS}
            value={flow.disposition}
            onChange={(disposition) => dispatch({ type: 'disposition', disposition })}
          />
          {cancelling ? (
            <View style={styles.stack}>
              <Notice tone="warning" message="Cancelling sends notice to waiting patients in the app. Guests have no app, so tell them in person." />
              <Checkbox
                checked={flow.confirmedNotify}
                onChange={(confirmed) => dispatch({ type: 'confirmNotify', confirmed })}
                label="I understand that waiting walk-ins will be cancelled."
                accessibilityLabel="Confirm walk-in cancellation"
              />
              {guestCount > 0 ? (
                <Checkbox
                  checked={flow.guestsInformed}
                  onChange={(informed) => dispatch({ type: 'guests', informed })}
                  label="I told the guests in person."
                  accessibilityLabel="Guests were told in person"
                />
              ) : null}
            </View>
          ) : null}
          <Button
            label="Check out"
            variant={cancelling ? 'danger' : 'primary'}
            onPress={() => submit.mutate()}
            loading={busy}
            disabled={!ready || busy || offline}
          />
          <Button label="Back" variant="secondary" onPress={() => dispatch({ type: 'back' })} disabled={busy} />
        </Card>
      ) : null}
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    body: { ...typography.body, color: c.textPrimary },
    meta: { ...typography.small, color: c.textMuted },
    stack: { gap: space[2] },
  });
