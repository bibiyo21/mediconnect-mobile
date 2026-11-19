import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Notice, Screen, StateView, TextField } from '@/components/ui';
import { acceptAssignment, endAssignment, fetchMyAssignments, type MyAssignment } from '@/features/doctors/api';
import { formatManilaDate } from '@/lib/dates';
import { fieldErrors, userMessage } from '@/lib/errors';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** Clinics that invited the doctor, and the ones where they practise (increment 2.10). */
export default function DoctorClinics() {
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const assignments = useQuery({ queryKey: ['doctor-assignments'], queryFn: fetchMyAssignments });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['doctor-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['doctor-services'] });
  };
  const accept = useMutation({ mutationFn: (a: MyAssignment) => acceptAssignment(a.id), onSuccess: (a) => { setMessage(`You now practise at ${a.clinic_name}, ${a.location_name}. Add your services and fees there.`); refresh(); } });
  const end = useMutation({
    mutationFn: (a: MyAssignment) => endAssignment(a.id, (reasons[a.id] ?? '').trim()),
    onSuccess: (a) => { setMessage(a.effective_from ? `You no longer practise at ${a.clinic_name}. Your services there have ended.` : `You declined ${a.clinic_name}.`); refresh(); },
  });

  if (assignments.isPending) return <Screen title="Your clinics"><StateView state="loading" message="Loading your clinics" /></Screen>;
  if (assignments.isError) return <Screen title="Your clinics"><StateView state="error" message={userMessage(assignments.error)} onRetry={() => assignments.refetch()} /></Screen>;

  const error = accept.error ?? end.error;
  const reasonError = end.error ? fieldErrors(end.error).reason : undefined;

  return (
    <Screen title="Your clinics" subtitle="A clinic invites you with your PRC licence number. You choose whether to accept.">
      {message ? <Notice tone="success" message={message} /> : null}
      {error && !reasonError ? <Notice tone="error" message={userMessage(error)} /> : null}
      {assignments.data.length === 0 ? <StateView state="empty" message="No clinic has invited you yet. Ask the clinic manager to invite you using your PRC licence number." /> : null}
      {assignments.data.map((a) => {
        const pending = a.status === 'PENDING';
        return (
          <Card key={a.id} title={a.clinic_name}>
            <Text style={styles.body}>{a.location_name}, {a.location_city}</Text>
            <Text style={styles.meta}>{pending ? `Invited ${formatManilaDate(a.requested_at)}` : `Practising here since ${a.effective_from ? formatManilaDate(a.effective_from) : '—'}`}</Text>
            {pending ? <Button label="Accept invitation" onPress={() => accept.mutate(a)} loading={accept.isPending && accept.variables?.id === a.id} /> : null}
            <View style={styles.end}>
              <TextField label={pending ? 'Reason for declining' : 'Reason for leaving'} value={reasons[a.id] ?? ''} onChangeText={(t) => setReasons({ ...reasons, [a.id]: t })} error={end.variables?.id === a.id ? reasonError : undefined} />
              <Button label={pending ? 'Decline' : 'Stop practising here'} variant="secondary" onPress={() => end.mutate(a)} loading={end.isPending && end.variables?.id === a.id} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    body: { ...typography.body, color: c.textPrimary },
    meta: { ...typography.small, color: c.textMuted },
    end: { gap: space[2] },
  });
