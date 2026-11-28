import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Notice, Screen, StateView } from '@/components/ui';
import { checkInReasonText, presenceErrorMessage } from '@/features/presence/copy';
import { formatShift, formatManilaTime } from '@/features/presence/format';
import { checkIn, PresenceError, type DayLocation } from '@/features/presence/api';
import { presenceKeys, useDoctorDay, useOffline, usePresenceState } from '@/features/presence/hooks';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** Pick a clinic and check in. The server decides each row's readiness; the app only shows it. */
export default function CheckIn() {
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const offline = useOffline();
  const day = useDoctorDay();
  const presence = usePresenceState();
  const [chosen, setChosen] = useState<DayLocation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A session is open at another clinic: offer the way back to the clinic day.
  const [openElsewhere, setOpenElsewhere] = useState(false);

  const submit = useMutation({
    mutationFn: (locationId: string) => checkIn(locationId),
    // A repeat check-in is 200 with the current state, so success covers it too.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: presenceKeys.me });
      void queryClient.invalidateQueries({ queryKey: presenceKeys.day });
      // dismissTo stops at the clinic day already in the stack (or replaces this screen when it is not there), so the stack keeps one clinic day.
      router.dismissTo('/doctor/presence');
    },
    onError: (error) => {
      setChosen(null);
      setNotice(presenceErrorMessage(error));
      const open = error instanceof PresenceError && error.reasonCode === 'open_session';
      setOpenElsewhere(open);
      if (open) void queryClient.invalidateQueries({ queryKey: presenceKeys.me });
    },
  });

  if (day.isPending || presence.isPending) {
    return (
      <Screen title="Check in">
        <StateView state="loading" message="Loading clinics for today" />
      </Screen>
    );
  }
  if (day.isError) {
    return (
      <Screen title="Check in">
        <StateView state="error" message={presenceErrorMessage(day.error)} onRetry={() => day.refetch()} />
      </Screen>
    );
  }

  const alreadyIn = presence.data !== undefined && presence.data.status !== 'NOT_CHECKED_IN' && presence.data.status !== 'OUT';

  return (
    <Screen title="Check in" subtitle="Choose the clinic you are at. Check-in is in person only.">
      {offline ? <Notice tone="warning" message="You are offline. Check-in needs a connection." /> : null}
      {notice ? <Notice tone="error" message={notice} /> : null}
      {openElsewhere ? <Button label="Go to clinic day" variant="secondary" onPress={() => router.dismissTo('/doctor/presence')} /> : null}
      {alreadyIn ? (
        <Card title="Already checked in">
          <Text style={styles.body}>You are checked in. Open your clinic day to see your status.</Text>
          <Button label="Go to clinic day" variant="secondary" onPress={() => router.dismissTo('/doctor/presence')} />
        </Card>
      ) : null}

      {day.data.locations.length === 0 ? (
        <StateView state="empty" message="You have no active clinic assignments, so there is nothing to check in to." />
      ) : (
        <Card title="Your clinics today">
          {day.data.locations.map((l) => {
            const allowed = l.check_in.allowed;
            const opensAt = formatManilaTime(l.check_in.opens_at);
            return (
              <View key={l.clinic_location_id} style={styles.row}>
                <Text style={styles.label}>{l.location_name}</Text>
                {l.shifts.length ? (
                  l.shifts.map((s) => (
                    <Text key={s.starts_at} style={styles.meta}>{formatShift(s.starts_at, s.ends_at)}</Text>
                  ))
                ) : (
                  <Text style={styles.meta}>No shift today.</Text>
                )}
                {allowed ? (
                  <Button
                    label={`Check in at ${l.location_name}`}
                    onPress={() => setChosen(l)}
                    disabled={offline || alreadyIn || submit.isPending}
                    accessibilityHint="Asks you to confirm before checking in"
                  />
                ) : (
                  <Text style={styles.meta}>{checkInReasonText(l.check_in.reason_code, opensAt)}</Text>
                )}
              </View>
            );
          })}
        </Card>
      )}

      {chosen ? (
        <Card title="Confirm check-in">
          <Text style={styles.body}>Check in at {chosen.location_name} now?</Text>
          <Button
            label="Confirm check-in"
            onPress={() => submit.mutate(chosen.clinic_location_id)}
            loading={submit.isPending}
            disabled={offline}
          />
          <Button label="Cancel" variant="secondary" onPress={() => setChosen(null)} disabled={submit.isPending} />
        </Card>
      ) : null}
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { gap: space[2], paddingTop: space[3] },
    label: { ...typography.label, color: c.textPrimary },
    body: { ...typography.body, color: c.textPrimary },
    meta: { ...typography.small, color: c.textMuted },
  });
