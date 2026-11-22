import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChoiceGroup, Notice, Screen, StateView } from '@/components/ui';
import { fetchMyDoctorProfile } from '@/features/doctors/api';
import { archiveSchedule, fetchOpenTimes, fetchSchedules, fetchServiceModes, setServiceMode, type BookingMode, type Schedule } from '@/features/scheduling/api';
import { BOOKING_MODES, dayName, formatManilaTime, formatTime } from '@/features/scheduling/format';
import { formatManilaDate } from '@/lib/dates';
import { userMessage } from '@/lib/errors';
import { manilaToday } from '@/lib/validation';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/**
 * The doctor's weekly schedule (increment 4.9): how each service is booked,
 * the schedules that make open times, and a preview of what patients see.
 * Archiving never cancels a booking; affected ones are flagged for rescheduling.
 */
export default function DoctorSchedule() {
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['doctor-profile'], queryFn: fetchMyDoctorProfile });
  const modes = useQuery({ queryKey: ['service-modes'], queryFn: fetchServiceModes });
  const schedules = useQuery({ queryKey: ['schedules'], queryFn: fetchSchedules });
  const active = profile.data?.onboarding_status === 'ACTIVE';
  const [{ today, weekEnd }] = useState(() => ({ today: manilaToday(), weekEnd: manilaToday(new Date(Date.now() + 6 * 86400 * 1000)) }));
  const preview = useQuery({ queryKey: ['open-times', profile.data?.id, today], queryFn: () => fetchOpenTimes(profile.data!.id, today, weekEnd), enabled: active });
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    queryClient.invalidateQueries({ queryKey: ['service-modes'] });
    queryClient.invalidateQueries({ queryKey: ['open-times'] });
  };
  const changeMode = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: BookingMode }) => setServiceMode(id, mode),
    onSuccess: (m) => { setMessage(`${m.service_name}: ${BOOKING_MODES.find((b) => b.value === m.service_mode)?.label.toLowerCase()}.`); refresh(); },
  });
  const archive = useMutation({
    mutationFn: (s: Schedule) => archiveSchedule(s.id, s.version),
    onSuccess: (r) => {
      setConfirming(null);
      const n = r.affected_appointments.length;
      setMessage(n === 0 ? 'Schedule archived. No booked appointments were affected.' : `Schedule archived. ${n} booked ${n === 1 ? 'appointment is' : 'appointments are'} kept and marked for rescheduling; nothing was cancelled.`);
      refresh();
    },
  });

  if (modes.isPending || schedules.isPending) return <Screen title="Weekly schedule"><StateView state="loading" message="Loading your schedule" /></Screen>;
  if (modes.isError || schedules.isError) {
    const error = modes.error ?? schedules.error;
    return <Screen title="Weekly schedule"><StateView state="error" message={userMessage(error)} onRetry={() => { modes.refetch(); schedules.refetch(); }} /></Screen>;
  }

  const modeName = (id: string) => modes.data.find((m) => m.service_mode_id === id);
  const byDate = (preview.data ?? []).reduce<Record<string, string[]>>((acc, t) => ({ ...acc, [t.local_date]: [...(acc[t.local_date] ?? []), formatManilaTime(t.starts_at)] }), {});

  return (
    <Screen title="Weekly schedule" subtitle="Set how patients book each service, then the hours you see them. Patients only see open times.">
      {message ? <Notice tone="success" message={message} /> : null}
      {changeMode.error || archive.error ? <Notice tone="error" message={userMessage(changeMode.error ?? archive.error)} /> : null}

      <Card title="How patients book">
        {modes.data.length === 0 ? <Text style={styles.meta}>Add a service first; then choose how it is booked.</Text> : null}
        {modes.data.map((m) => (
          <View key={m.doctor_service_id} style={styles.item}>
            <Text style={styles.name}>{m.service_name}</Text>
            <Text style={styles.meta}>{m.consultation_type === 'ONLINE' ? 'Online' : m.location_name ?? 'At a clinic'}</Text>
            {m.service_mode === null ? <Notice tone="info" message="Not set yet: patients cannot book this service." /> : null}
            <ChoiceGroup<BookingMode | ''>
              label={`Booking for ${m.service_name}`}
              value={(m.service_mode as BookingMode | null) ?? ''}
              onChange={(mode) => { if (mode) { setMessage(null); changeMode.mutate({ id: m.doctor_service_id, mode }); } }}
              options={m.consultation_type === 'ONLINE' ? BOOKING_MODES.filter((b) => b.value === 'APPOINTMENT') : BOOKING_MODES}
            />
          </View>
        ))}
      </Card>

      <Card title="Schedules">
        {schedules.data.length === 0 ? <Text style={styles.meta}>No schedule yet. Add one to start showing open times.</Text> : null}
        {schedules.data.map((s) => (
          <View key={s.id} style={styles.item}>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={styles.meta}>
              {s.status === 'DRAFT' ? 'Draft, not shown to patients' : 'Active'} · from {s.effective_from ? formatManilaDate(`${s.effective_from}T00:00:00+08:00`) : 'now'}
              {s.effective_until ? ` until ${formatManilaDate(`${s.effective_until}T00:00:00+08:00`)}` : ''}
            </Text>
            <View role="list" aria-label={`Shifts in ${s.name}`} style={styles.shifts}>
              {[...s.shifts].sort((a, b) => a.day_of_week - b.day_of_week || a.starts_at.localeCompare(b.starts_at)).map((sh) => (
                <Text key={sh.id} role="listitem" style={styles.shift}>
                  {dayName(sh.day_of_week)} {formatTime(sh.starts_at)} to {formatTime(sh.ends_at)} · {modeName(sh.doctor_service_mode_id)?.service_name ?? 'Service'} · {sh.slot_duration_minutes}-minute slots
                  {sh.buffer_minutes ? `, ${sh.buffer_minutes} min between` : ''}
                  {sh.breaks.map((b) => `, break ${formatTime(b.starts_at)} to ${formatTime(b.ends_at)}`).join('')}
                </Text>
              ))}
            </View>
            {confirming === s.id ? (
              <View style={styles.confirm}>
                <Notice tone="warning" message="Archive this schedule? Its open times disappear. Appointments already booked are kept and marked for rescheduling; none are cancelled." />
                <View style={styles.row}>
                  <Button label="Archive schedule" variant="danger" onPress={() => archive.mutate(s)} loading={archive.isPending} />
                  <Button label="Keep it" variant="secondary" onPress={() => setConfirming(null)} />
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <Button label={`Edit ${s.name}`} variant="secondary" onPress={() => router.push({ pathname: '/doctor/schedule-edit', params: { id: s.id } })} />
                <Button label="Archive" variant="secondary" onPress={() => { setMessage(null); setConfirming(s.id); }} />
              </View>
            )}
          </View>
        ))}
        <Button label="Add a schedule" onPress={() => router.push('/doctor/schedule-edit')} disabled={modes.data.every((m) => m.service_mode_id === null)} />
        {modes.data.every((m) => m.service_mode_id === null) && modes.data.length > 0 ? <Text style={styles.meta}>Choose how at least one service is booked first.</Text> : null}
      </Card>

      <Card title="Time off and extra hours">
        <Text style={styles.meta}>Leave, sick days and extra hours override your weekly schedule for those dates.</Text>
        <Button label="Time off and extra hours" variant="secondary" onPress={() => router.push('/doctor/time-off')} />
      </Card>

      <Card title="What patients see this week">
        {!active ? <Text style={styles.meta}>Patients see your open times once MediConnect activates your profile.</Text> : null}
        {active && preview.isPending ? <StateView state="loading" message="Loading open times" /> : null}
        {active && preview.isError ? <Notice tone="error" message={userMessage(preview.error)} /> : null}
        {active && preview.data && preview.data.length === 0 ? <Text style={styles.meta}>No open times in the next 7 days.</Text> : null}
        {Object.entries(byDate).map(([date, times]) => (
          <View key={date} style={styles.day}>
            <Text style={styles.name}>{formatManilaDate(`${date}T00:00:00+08:00`)}</Text>
            <Text style={styles.meta}>{times.length} open: {times.slice(0, 8).join(', ')}{times.length > 8 ? ' and more' : ''}</Text>
          </View>
        ))}
        {active ? <Text style={styles.meta}>Times update within a minute of a change. Booked and held times are not shown.</Text> : null}
      </Card>
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    item: { gap: space[2], paddingVertical: space[2], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    name: { ...typography.label, color: c.textPrimary },
    meta: { ...typography.small, color: c.textMuted },
    shifts: { gap: space[1] },
    shift: { ...typography.small, color: c.textPrimary },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
    confirm: { gap: space[2] },
    day: { gap: space[1] },
  });
