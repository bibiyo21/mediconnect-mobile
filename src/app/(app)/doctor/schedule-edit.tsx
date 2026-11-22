import { ApiError } from '@mediconnect/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ChoiceGroup, Notice, Screen, StateView, TextField } from '@/components/ui';
import { createSchedule, fetchSchedule, fetchServiceModes, updateSchedule, type Schedule, type ScheduleInput, type ServiceMode, type ShiftInput } from '@/features/scheduling/api';
import { DAYS, isDate, shiftErrors, slotEstimate } from '@/features/scheduling/format';
import { fieldErrors, userMessage } from '@/lib/errors';
import { manilaToday } from '@/lib/validation';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** A shift as typed: numbers stay text until saving, so a half-typed value is never lost. */
interface ShiftDraft {
  day: string;
  mode: string;
  start: string;
  end: string;
  length: string;
  buffer: string;
  cap: string;
  breakStart: string;
  breakEnd: string;
}

const blank = (mode: string): ShiftDraft => ({ day: '1', mode, start: '09:00', end: '12:00', length: '20', buffer: '5', cap: '', breakStart: '', breakEnd: '' });

function toDraft(s: Schedule['shifts'][number]): ShiftDraft {
  return {
    day: String(s.day_of_week), mode: s.doctor_service_mode_id, start: s.starts_at, end: s.ends_at, length: String(s.slot_duration_minutes), buffer: String(s.buffer_minutes),
    cap: s.max_appointments ? String(s.max_appointments) : '', breakStart: s.breaks[0]?.starts_at ?? '', breakEnd: s.breaks[0]?.ends_at ?? '',
  };
}

function toInput(d: ShiftDraft): ShiftInput {
  return {
    day_of_week: Number(d.day), doctor_service_mode_id: d.mode, starts_at: d.start.trim(), ends_at: d.end.trim(),
    slot_duration_minutes: Number(d.length), buffer_minutes: d.buffer.trim() === '' ? 0 : Number(d.buffer), max_appointments: d.cap.trim() === '' ? null : Number(d.cap),
    breaks: d.breakStart.trim() || d.breakEnd.trim() ? [{ starts_at: d.breakStart.trim(), ends_at: d.breakEnd.trim() }] : [],
  };
}

/**
 * Add or edit a weekly schedule (increment 4.9). One schedule covers one place;
 * each shift picks a day, a service and the slot length. Saving with a stale
 * version is refused (409), so two editors never overwrite each other.
 */
export default function ScheduleEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const modes = useQuery({ queryKey: ['service-modes'], queryFn: fetchServiceModes });
  const existing = useQuery({ queryKey: ['schedule', id], queryFn: () => fetchSchedule(id!), enabled: Boolean(id) });
  const title = id ? 'Edit schedule' : 'Add a schedule';

  if (modes.isPending || (id && existing.isPending)) return <Screen title={title}><StateView state="loading" message="Loading" /></Screen>;
  if (modes.isError || existing.isError) return <Screen title={title}><StateView state="error" message={userMessage(modes.error ?? existing.error)} onRetry={() => { modes.refetch(); existing.refetch(); }} /></Screen>;

  const usable = modes.data.filter((m) => m.service_mode_id !== null && m.service_mode !== 'WALK_IN');
  if (usable.length === 0) {
    return (
      <Screen title={title}>
        <Notice tone="info" message="Set at least one service to appointments or both before adding a schedule. Walk-in-only services do not use appointment times." />
        <Button label="Back to your schedule" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  // Keyed by version: after a reload the form starts again from the latest schedule.
  return <ScheduleForm key={existing.data ? `${existing.data.id}:${existing.data.version}` : 'new'} title={title} schedule={existing.data ?? null} usable={usable} onReload={() => existing.refetch()} />;
}

function ScheduleForm({ title, schedule, usable, onReload }: { title: string; schedule: Schedule | null; usable: ServiceMode[]; onReload: () => void }) {
  const styles = useThemedStyles(createStyles);
  const queryClient = useQueryClient();
  const [name, setName] = useState(schedule?.name ?? '');
  const [from, setFrom] = useState(() => schedule?.effective_from ?? manilaToday());
  const [status, setStatus] = useState<'ACTIVE' | 'DRAFT'>(schedule?.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE');
  const [shifts, setShifts] = useState<ShiftDraft[]>(() => (schedule ? schedule.shifts.map(toDraft) : [blank(usable[0].service_mode_id!)]));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const id = schedule?.id;

  const save = useMutation({
    mutationFn: (body: ScheduleInput) => (schedule ? updateSchedule(schedule.id, schedule.version, body) : createSchedule(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['open-times'] });
      router.back();
    },
  });

  const stale = save.error instanceof ApiError && save.error.code === 'CONCURRENT_MODIFICATION';
  const errors = { ...(save.error ? fieldErrors(save.error) : {}), ...localErrors };
  const update = (i: number, patch: Partial<ShiftDraft>) => setShifts(shifts.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const submit = () => {
    const inputs = shifts.map(toInput);
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Give the schedule a name, for example "Makati clinic".';
    if (!isDate(from)) next.effective_from = 'Use a date like 2026-12-01.';
    if (inputs.length === 0) next.shifts = 'Add at least one shift.';
    inputs.forEach((s, i) => {
      Object.assign(next, shiftErrors(s, i));
      if (Number.isNaN(s.slot_duration_minutes)) next[`shifts.${i}.slot_duration_minutes`] = 'Use 5 to 480 minutes.';
    });
    setLocalErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate({ name: name.trim(), effective_from: from, status, shifts: inputs });
  };

  const otherError = save.error && !stale && Object.keys(fieldErrors(save.error)).length === 0 ? save.error : null;

  return (
    <Screen title={title} subtitle="Times are Philippine time. One schedule covers one place: a clinic or online.">
      {stale ? (
        <View style={styles.block}>
          <Notice tone="warning" message="This schedule was changed somewhere else since you opened it. Reload it to see the latest version, then make your change again." />
          <Button label="Reload schedule" variant="secondary" onPress={() => { save.reset(); onReload(); }} />
        </View>
      ) : null}
      {otherError ? <Notice tone="error" message={userMessage(otherError)} /> : null}
      {errors.shifts ? <Notice tone="error" message={errors.shifts} /> : null}

      <Card title="Schedule">
        <TextField label="Name" value={name} onChangeText={setName} error={errors.name} hint="Only you and your clinic see this." />
        <TextField label="Starts on" value={from} onChangeText={setFrom} error={errors.effective_from} hint="YYYY-MM-DD" autoCapitalize="none" />
        <ChoiceGroup<'ACTIVE' | 'DRAFT'> label="Show to patients" value={status} onChange={setStatus} options={[{ value: 'ACTIVE', label: 'Yes, from the start date' }, { value: 'DRAFT', label: 'Not yet (draft)' }]} />
      </Card>

      {shifts.map((s, i) => {
        const e = (f: string) => errors[`shifts.${i}.${f}`];
        const estimate = slotEstimate(toInput(s));
        return (
          <Card key={i} title={`Shift ${i + 1}`}>
            <ChoiceGroup<string> label={`Day for shift ${i + 1}`} value={s.day} onChange={(day) => update(i, { day })} options={DAYS.map((d) => ({ value: String(d.value), label: d.short }))} error={e('day_of_week')} />
            <ChoiceGroup<string>
              label={`Service for shift ${i + 1}`}
              value={s.mode}
              onChange={(mode) => update(i, { mode })}
              error={e('doctor_service_mode_id')}
              options={usable.map((m) => ({ value: m.service_mode_id!, label: `${m.service_name} · ${m.consultation_type === 'ONLINE' ? 'Online' : m.location_name ?? 'Clinic'}` }))}
            />
            <View style={styles.pair}>
              <View style={styles.half}><TextField label="From" value={s.start} onChangeText={(start) => update(i, { start })} error={e('starts_at')} hint="HH:MM" /></View>
              <View style={styles.half}><TextField label="To" value={s.end} onChangeText={(end) => update(i, { end })} error={e('ends_at')} hint="HH:MM" /></View>
            </View>
            <View style={styles.pair}>
              <View style={styles.half}><TextField label="Minutes per patient" keyboardType="number-pad" value={s.length} onChangeText={(length) => update(i, { length })} error={e('slot_duration_minutes')} /></View>
              <View style={styles.half}><TextField label="Minutes between patients" keyboardType="number-pad" value={s.buffer} onChangeText={(buffer) => update(i, { buffer })} error={e('buffer_minutes')} /></View>
            </View>
            <TextField label="Most patients in this shift" keyboardType="number-pad" value={s.cap} onChangeText={(cap) => update(i, { cap })} error={e('max_appointments')} hint="Leave empty for no limit." />
            <View style={styles.pair}>
              <View style={styles.half}><TextField label="Break from" value={s.breakStart} onChangeText={(breakStart) => update(i, { breakStart })} error={errors[`shifts.${i}.breaks.0.starts_at`]} hint="Optional, HH:MM" /></View>
              <View style={styles.half}><TextField label="Break to" value={s.breakEnd} onChangeText={(breakEnd) => update(i, { breakEnd })} error={errors[`shifts.${i}.breaks.0.ends_at`]} hint="Optional, HH:MM" /></View>
            </View>
            <Text style={styles.meta} accessibilityLiveRegion="polite">
              About {estimate} {estimate === 1 ? 'appointment' : 'appointments'} each {DAYS.find((d) => String(d.value) === s.day)?.long ?? 'day'}, before clinic hours and time off.
            </Text>
            {shifts.length > 1 ? <Button label={`Remove shift ${i + 1}`} variant="secondary" onPress={() => setShifts(shifts.filter((_, j) => j !== i))} /> : null}
          </Card>
        );
      })}

      <View style={styles.block}>
        <Button label="Add another shift" variant="secondary" onPress={() => setShifts([...shifts, { ...(shifts[shifts.length - 1] ?? blank(usable[0].service_mode_id!)), day: String(Math.min(7, Number(shifts[shifts.length - 1]?.day ?? 0) + 1)) }])} disabled={shifts.length >= 50} />
        <Button label={id ? 'Save changes' : 'Save schedule'} onPress={submit} loading={save.isPending} />
        {id ? <Text style={styles.meta}>Appointments already booked are kept. Any that no longer fit are marked for rescheduling, never cancelled.</Text> : null}
      </View>
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    block: { gap: space[2] },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
    half: { flexGrow: 1, flexBasis: 140 },
    meta: { ...typography.small, color: c.textMuted },
  });
