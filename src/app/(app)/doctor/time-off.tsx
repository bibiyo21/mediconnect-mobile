import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChoiceGroup, Notice, Screen, StateView, TextField } from '@/components/ui';
import { fetchMyAssignments } from '@/features/doctors/api';
import { cancelException, createException, fetchExceptions, fetchServiceModes, type ExceptionType, type ScheduleException } from '@/features/scheduling/api';
import { TIME_OFF_TYPES, exceptionLabel, formatManilaTime, isDate, isTime, manilaInstant } from '@/features/scheduling/format';
import { formatManilaDate } from '@/lib/dates';
import { fieldErrors, userMessage } from '@/lib/errors';
import { manilaToday } from '@/lib/validation';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/**
 * Time off and extra hours (increment 4.9): leave and unavailability block
 * open times; extra hours add them for one service. Booked appointments in a
 * blocked time are kept and marked for rescheduling, never cancelled (§8.3).
 */
export default function TimeOff() {
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const exceptions = useQuery({ queryKey: ['schedule-exceptions'], queryFn: fetchExceptions });
  const assignments = useQuery({ queryKey: ['doctor-assignments'], queryFn: fetchMyAssignments });
  const modes = useQuery({ queryKey: ['service-modes'], queryFn: fetchServiceModes });
  const places = (assignments.data ?? []).filter((a) => a.status === 'ACTIVE');

  const [type, setType] = useState<ExceptionType>('VACATION');
  const [place, setPlace] = useState<string>('all');
  const [mode, setMode] = useState<string>('');
  const [startDate, setStartDate] = useState(() => manilaToday(new Date(Date.now() + 86400 * 1000)));
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(() => manilaToday(new Date(Date.now() + 86400 * 1000)));
  const [endTime, setEndTime] = useState('23:59');
  const [reason, setReason] = useState('');
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['schedule-exceptions'] });
    queryClient.invalidateQueries({ queryKey: ['open-times'] });
  };
  const add = useMutation({
    mutationFn: createException,
    onSuccess: (r) => {
      const n = r.affected_appointments.length;
      setMessage(`${exceptionLabel(r.exception_type)} saved.${n > 0 ? ` ${n} booked ${n === 1 ? 'appointment falls' : 'appointments fall'} in this time. ${n === 1 ? 'It is' : 'They are'} kept and marked for rescheduling; nothing was cancelled.` : ''}`);
      setReason('');
      refresh();
    },
  });
  const cancel = useMutation({ mutationFn: (e: ScheduleException) => cancelException(e.id), onSuccess: () => { setMessage('Removed. Your weekly schedule applies again for those dates.'); refresh(); } });

  if (exceptions.isPending || assignments.isPending || modes.isPending) return <Screen title="Time off and extra hours"><StateView state="loading" message="Loading" /></Screen>;
  if (exceptions.isError) return <Screen title="Time off and extra hours"><StateView state="error" message={userMessage(exceptions.error)} onRetry={() => exceptions.refetch()} /></Screen>;

  const extra = type === 'SPECIAL_HOURS';
  const placeModes = (modes.data ?? []).filter((m) => m.service_mode_id !== null && m.service_mode !== 'WALK_IN' && (place === 'online' ? m.consultation_type === 'ONLINE' : m.clinic_location_id === place));
  const chosenMode = placeModes.some((m) => m.service_mode_id === mode) ? mode : placeModes[0]?.service_mode_id ?? '';
  const placeOptions = [
    ...(extra ? [] : [{ value: 'all', label: 'Everywhere I work' }]),
    ...places.map((a) => ({ value: a.clinic_location_id, label: `${a.clinic_name}, ${a.location_name}` })),
    ...(extra ? [{ value: 'online', label: 'Online' }] : []),
  ];
  const chosenPlace = placeOptions.some((o) => o.value === place) ? place : placeOptions[0]?.value ?? 'all';
  const errors = { ...(add.error ? fieldErrors(add.error) : {}), ...localErrors };

  const submit = () => {
    const next: Record<string, string> = {};
    if (!isDate(startDate) || !isTime(startTime)) next.starts_at = 'Use a date like 2026-12-24 and a time like 09:00.';
    if (!isDate(endDate) || !isTime(endTime)) next.ends_at = 'Use a date like 2026-12-26 and a time like 17:00.';
    else if (!next.starts_at && `${endDate}T${endTime}` <= `${startDate}T${startTime}`) next.ends_at = 'The end must be after the start.';
    if (extra && !chosenMode) next.doctor_service_mode_id = 'Choose a service that takes appointments at this place.';
    setLocalErrors(next);
    setMessage(null);
    if (Object.keys(next).length > 0) return;
    add.mutate({
      exception_type: type,
      clinic_location_id: chosenPlace === 'all' || chosenPlace === 'online' ? null : chosenPlace,
      doctor_service_mode_id: extra ? chosenMode : null,
      starts_at: manilaInstant(startDate, startTime),
      ends_at: manilaInstant(endDate, endTime),
      reason: reason.trim() || null,
    });
  };

  const otherError = add.error && Object.keys(fieldErrors(add.error)).length === 0 ? add.error : cancel.error;

  return (
    <Screen title="Time off and extra hours" subtitle="These override your weekly schedule for the dates you choose. Times are Philippine time.">
      {message ? <Notice tone="success" message={message} /> : null}
      {otherError ? <Notice tone="error" message={userMessage(otherError)} /> : null}

      <Card title="Coming up">
        {exceptions.data.length === 0 ? <Text style={styles.meta}>Nothing planned. Your weekly schedule applies.</Text> : null}
        {exceptions.data.map((e) => (
          <View key={e.id} style={styles.item}>
            <Text style={styles.name}>{exceptionLabel(e.exception_type)}{e.effect === 'ADD_HOURS' ? ' (adds open times)' : ''}</Text>
            <Text style={styles.meta}>
              {e.starts_at ? `${formatManilaDate(e.starts_at)} ${formatManilaTime(e.starts_at)}` : ''} to {e.ends_at ? `${formatManilaDate(e.ends_at)} ${formatManilaTime(e.ends_at)}` : ''}
              {' · '}{e.clinic_location_id ? places.find((a) => a.clinic_location_id === e.clinic_location_id)?.clinic_name ?? 'One clinic' : e.effect === 'ADD_HOURS' ? 'Online' : 'Everywhere'}
            </Text>
            {e.exception_type === 'CLINIC_CLOSURE' || e.exception_type === 'PUBLIC_HOLIDAY' ? <Text style={styles.meta}>Set by your clinic.</Text> : (
              <Button label={`Remove ${exceptionLabel(e.exception_type).toLowerCase()}`} variant="secondary" onPress={() => cancel.mutate(e)} loading={cancel.isPending && cancel.variables?.id === e.id} />
            )}
          </View>
        ))}
      </Card>

      <Card title="Add time off or extra hours">
        <ChoiceGroup<ExceptionType> label="What" value={type} onChange={setType} options={TIME_OFF_TYPES} />
        <ChoiceGroup<string> label="Where" value={chosenPlace} onChange={setPlace} options={placeOptions} error={errors.clinic_location_id} />
        {extra ? (
          placeModes.length === 0 ? <Notice tone="info" message="No service here takes appointments yet. Set one to appointments or both on your weekly schedule first." /> : (
            <ChoiceGroup<string> label="For which service" value={chosenMode} onChange={setMode} error={errors.doctor_service_mode_id} options={placeModes.map((m) => ({ value: m.service_mode_id!, label: m.service_name }))} />
          )
        ) : null}
        <View style={styles.pair}>
          <View style={styles.half}><TextField label="Start date" value={startDate} onChangeText={setStartDate} hint="YYYY-MM-DD" autoCapitalize="none" error={errors.starts_at} /></View>
          <View style={styles.half}><TextField label="Start time" value={startTime} onChangeText={setStartTime} hint="HH:MM" /></View>
        </View>
        <View style={styles.pair}>
          <View style={styles.half}><TextField label="End date" value={endDate} onChangeText={setEndDate} hint="YYYY-MM-DD" autoCapitalize="none" error={errors.ends_at} /></View>
          <View style={styles.half}><TextField label="End time" value={endTime} onChangeText={setEndTime} hint="HH:MM" /></View>
        </View>
        <TextField label="Note (optional)" value={reason} onChangeText={setReason} hint="Only you and your clinic see this." error={errors.reason} />
        {!extra ? <Notice tone="info" message="Appointments already booked in this time are not cancelled. They are marked for rescheduling so the clinic can contact the patients." /> : null}
        <Button label={extra ? 'Add extra hours' : 'Save time off'} onPress={submit} loading={add.isPending} />
      </Card>
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    item: { gap: space[2], paddingVertical: space[2], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    name: { ...typography.label, color: c.textPrimary },
    meta: { ...typography.small, color: c.textMuted },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
    half: { flexGrow: 1, flexBasis: 140 },
  });
