import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChoiceGroup, Notice, Screen, StateView, TextField } from '@/components/ui';
import { addService, changeServiceFee, fetchMyAssignments, fetchMyServices, removeService, type MyService } from '@/features/doctors/api';
import { fieldErrors, userMessage } from '@/lib/errors';
import { centavosToPesos, pesosToCentavos } from '@/lib/money';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

type Mode = 'IN_PERSON' | 'ONLINE';

/**
 * The doctor's services and fees, per clinic location or online (increment
 * 2.10). Fees are typed in pesos and sent as centavos; the server is the only
 * source of the fee a patient pays.
 */
export default function DoctorServices() {
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const services = useQuery({ queryKey: ['doctor-services'], queryFn: fetchMyServices });
  const assignments = useQuery({ queryKey: ['doctor-assignments'], queryFn: fetchMyAssignments });
  const active = (assignments.data ?? []).filter((a) => a.status === 'ACTIVE');

  const [mode, setMode] = useState<Mode>('IN_PERSON');
  const [locationId, setLocationId] = useState<string>('');
  const [name, setName] = useState('Consultation');
  const [minutes, setMinutes] = useState('20');
  const [fee, setFee] = useState('');
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [fees, setFees] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['doctor-services'] });
  const add = useMutation({
    mutationFn: addService,
    onSuccess: (s) => { setMessage(`Added ${s.name} at ${s.fee.formatted}.`); setFee(''); refresh(); },
  });
  const change = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => changeServiceFee(id, amount),
    onSuccess: (s) => { setMessage(`${s.name} now costs ${s.fee.formatted}. Bookings already made keep their fee.`); refresh(); },
  });
  const remove = useMutation({ mutationFn: (s: MyService) => removeService(s.id), onSuccess: () => { setMessage('Service removed.'); refresh(); } });

  if (services.isPending || assignments.isPending) return <Screen title="Services and fees"><StateView state="loading" message="Loading your services" /></Screen>;
  if (services.isError) return <Screen title="Services and fees"><StateView state="error" message={userMessage(services.error)} onRetry={() => services.refetch()} /></Screen>;

  const chosenLocation = locationId || active[0]?.clinic_location_id || '';
  const serverErrors = add.error ? fieldErrors(add.error) : {};
  const errors = { ...serverErrors, ...localErrors };

  const submit = () => {
    const amount = pesosToCentavos(fee);
    const duration = Number(minutes);
    const next: Record<string, string> = {};
    if (amount === null) next.fee_amount = 'Enter the fee in pesos, for example 650 or 650.50.';
    if (!Number.isInteger(duration) || duration < 5 || duration > 240 || duration % 5 !== 0) next.duration_minutes = 'Use 5 to 240 minutes, in steps of 5.';
    if (name.trim().length < 3) next.name = 'Give the service a name of at least 3 letters.';
    if (mode === 'IN_PERSON' && !chosenLocation) next.clinic_location_id = 'Accept a clinic invitation first.';
    setLocalErrors(next);
    setMessage(null);
    if (Object.keys(next).length > 0 || amount === null) return;
    add.mutate({ consultation_type: mode, clinic_location_id: mode === 'IN_PERSON' ? chosenLocation : null, name: name.trim(), duration_minutes: duration, fee_amount: amount });
  };

  const groups = [
    ...active.map((a) => ({ key: a.clinic_location_id, title: `${a.clinic_name}, ${a.location_name}`, items: services.data.filter((s) => s.clinic_location_id === a.clinic_location_id) })),
    { key: 'online', title: 'Online consultations', items: services.data.filter((s) => s.consultation_type === 'ONLINE') },
  ];
  const otherError = add.error && Object.keys(serverErrors).length === 0 ? add.error : change.error ?? remove.error;

  return (
    <Screen title="Services and fees" subtitle="Patients see the fee before they book. Changing a fee never changes bookings already made.">
      {message ? <Notice tone="success" message={message} /> : null}
      {otherError ? <Notice tone="error" message={userMessage(otherError)} /> : null}

      {groups.map((g) => (
        <Card key={g.key} title={g.title}>
          {g.items.length === 0 ? <Text style={styles.meta}>No services here yet.</Text> : null}
          {g.items.map((s) => (
            <View key={s.id} style={styles.service}>
              <Text style={styles.name}>{s.name}{s.is_follow_up ? ' (follow-up)' : ''}</Text>
              <Text style={styles.meta}>{s.duration_minutes} minutes · {s.fee.amount === 0 ? 'Free' : s.fee.formatted}</Text>
              <TextField label={`New fee for ${s.name} (₱)`} keyboardType="decimal-pad" value={fees[s.id] ?? centavosToPesos(s.fee.amount)} onChangeText={(t) => setFees({ ...fees, [s.id]: t })} />
              <View style={styles.row}>
                <Button label="Save fee" variant="secondary" onPress={() => { const amount = pesosToCentavos(fees[s.id] ?? ''); if (amount !== null) change.mutate({ id: s.id, amount }); else setMessage(null); }} loading={change.isPending && change.variables?.id === s.id} disabled={pesosToCentavos(fees[s.id] ?? '') === null} />
                <Button label="Remove" variant="secondary" onPress={() => remove.mutate(s)} loading={remove.isPending && remove.variables?.id === s.id} />
              </View>
            </View>
          ))}
        </Card>
      ))}

      <Card title="Add a service">
        <ChoiceGroup<Mode> label="Where" value={mode} onChange={setMode} options={[{ value: 'IN_PERSON', label: 'At a clinic' }, { value: 'ONLINE', label: 'Online' }]} />
        {mode === 'IN_PERSON' ? (
          active.length === 0 ? <Notice tone="info" message="Accept a clinic invitation before adding in-person services." /> : (
            <ChoiceGroup<string> label="Clinic" value={chosenLocation} onChange={setLocationId} error={errors.clinic_location_id} options={active.map((a) => ({ value: a.clinic_location_id, label: `${a.clinic_name}, ${a.location_name}` }))} />
          )
        ) : null}
        <TextField label="Service name" value={name} onChangeText={setName} error={errors.name} />
        <TextField label="Length in minutes" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} error={errors.duration_minutes} />
        <TextField label="Fee (₱)" hint="For example 650 or 650.50. Enter 0 for a free service." keyboardType="decimal-pad" value={fee} onChangeText={setFee} error={errors.fee_amount} />
        <Button label="Add service" onPress={submit} loading={add.isPending} />
      </Card>
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    service: { gap: space[2], paddingVertical: space[2], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    name: { ...typography.label, color: c.textPrimary },
    meta: { ...typography.small, color: c.textMuted },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  });
