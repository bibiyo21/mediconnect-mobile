import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, ChoiceGroup, LinkButton, Notice, Screen, StateView } from '@/components/ui';
import { BOOKING_NOTICE, fetchDoctor, fetchDoctorServices, languageName, type PublicService } from '@/features/directory/api';
import { fetchOpenTimes, type OpenTime } from '@/features/scheduling/api';
import { formatManilaTime } from '@/features/scheduling/format';
import { formatManilaDate } from '@/lib/dates';
import { userMessage } from '@/lib/errors';
import { manilaToday } from '@/lib/validation';
import { radius, space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** A doctor's public profile, where they practise and their fees (read only). */
export default function DirectoryDoctor() {
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const doctor = useQuery({ queryKey: ['directory-doctor', id], queryFn: () => fetchDoctor(id) });
  const services = useQuery({ queryKey: ['directory-doctor-services', id], queryFn: () => fetchDoctorServices(id) });

  if (doctor.isPending) return <Screen title="Doctor"><StateView state="loading" message="Loading doctor" /></Screen>;
  if (doctor.isError) return <Screen title="Doctor"><StateView state="error" message={userMessage(doctor.error)} onRetry={() => doctor.refetch()} /></Screen>;
  const d = doctor.data;
  const all = services.data ?? [];
  const online = all.filter((s) => s.consultation_type === 'ONLINE');

  return (
    <Screen title={d.display_name} subtitle={[d.professional_title, d.primary_specialty].filter(Boolean).join(' · ') || undefined}>
      {d.licence_verified ? <Notice tone="success" message="PRC licence checked by MediConnect." /> : null}
      <Notice tone="info" message={BOOKING_NOTICE} />
      <Card title="About">
        <Text style={styles.body}>{d.biography ?? 'No biography yet.'}</Text>
        {d.specialties.length ? <Text style={styles.meta}>Specialties: {d.specialties.map((s) => `${s.name}${s.board_certified ? ' (board certified)' : ''}`).join(', ')}</Text> : null}
        {d.languages.length ? <Text style={styles.meta}>Languages: {d.languages.map(languageName).join(', ')}</Text> : null}
        {d.years_experience != null ? <Text style={styles.meta}>Experience: {d.years_experience} years</Text> : null}
      </Card>
      {d.practice_locations.map((l) => (
        <Card key={l.clinic_location_id} title={l.clinic_name}>
          <Text style={styles.meta}>{l.location_name}, {l.city}</Text>
          <Services items={all.filter((s) => s.clinic_location_id === l.clinic_location_id)} />
          <LinkButton label={`About ${l.clinic_name}`} onPress={() => router.push(`/directory/clinic/${l.clinic_id}`)} />
        </Card>
      ))}
      {online.length ? <Card title="Online consultation"><Services items={online} /></Card> : null}
      <OpenTimes doctorId={d.id} places={[...d.practice_locations.map((l) => ({ key: l.clinic_location_id, label: `${l.clinic_name}, ${l.location_name}` })), ...(online.length ? [{ key: 'online', label: 'Online' }] : [])]} />
      <Text style={styles.meta}>Fees are set by the doctor. HMO coverage is confirmed by the clinic, never assumed.</Text>
    </Screen>
  );
}

/**
 * Open times for the next two weeks (increment 4.10), from the advisory
 * availability read. Shown as text, not buttons: booking arrives in Phase 6,
 * and every time is confirmed by the clinic.
 */
function OpenTimes({ doctorId, places }: { doctorId: string; places: { key: string; label: string }[] }) {
  const styles = useThemedStyles(createStyles);
  const [range] = useState(() => ({ from: manilaToday(), to: manilaToday(new Date(Date.now() + 13 * 86400 * 1000)) }));
  const times = useQuery({ queryKey: ['directory-open-times', doctorId, range.from], queryFn: () => fetchOpenTimes(doctorId, range.from, range.to), staleTime: 60_000 });
  const [place, setPlace] = useState<string>('');
  const [day, setDay] = useState<string>('');

  const keyOf = (t: OpenTime) => (t.consultation_type === 'ONLINE' ? 'online' : t.clinic_location_id ?? '');
  const all = times.data ?? [];
  const withTimes = places.filter((p) => all.some((t) => keyOf(t) === p.key));
  const chosenPlace = withTimes.some((p) => p.key === place) ? place : withTimes[0]?.key ?? '';
  const here = all.filter((t) => keyOf(t) === chosenPlace);
  const days = [...new Set(here.map((t) => t.local_date))];
  const chosenDay = days.includes(day) ? day : days[0] ?? '';
  const onDay = here.filter((t) => t.local_date === chosenDay);

  return (
    <Card title="Open times">
      {times.isPending ? <StateView state="loading" message="Loading open times" /> : null}
      {times.isError ? <Text style={styles.meta}>Open times could not be loaded. Contact the clinic for availability.</Text> : null}
      {times.data && withTimes.length === 0 ? <Text style={styles.meta}>No open times in the next two weeks. The clinic may still have openings; contact them directly.</Text> : null}
      {withTimes.length > 1 ? <ChoiceGroup<string> label="Where" value={chosenPlace} onChange={setPlace} options={withTimes.map((p) => ({ value: p.key, label: p.label }))} /> : null}
      {withTimes.length === 1 ? <Text style={styles.meta}>{withTimes[0].label}</Text> : null}
      {days.length > 0 ? (
        <ChoiceGroup<string> label="Day" value={chosenDay} onChange={setDay} options={days.slice(0, 14).map((d) => ({ value: d, label: formatManilaDate(`${d}T00:00:00+08:00`).replace(/ \d{4}$/, '') }))} />
      ) : null}
      {onDay.length > 0 ? (
        <View role="list" aria-label={`Open times on ${formatManilaDate(`${chosenDay}T00:00:00+08:00`)}`} style={styles.times}>
          {onDay.map((t) => (
            <Text key={t.slot_id} role="listitem" style={styles.time}>{formatManilaTime(t.starts_at)}</Text>
          ))}
        </View>
      ) : null}
      {withTimes.length > 0 ? <Text style={styles.meta}>Philippine time. A guide only: times change as patients book, and the clinic confirms every appointment.</Text> : null}
    </Card>
  );
}

function Services({ items }: { items: PublicService[] }) {
  const styles = useThemedStyles(createStyles);
  if (!items.length) return <Text style={styles.meta}>No services listed here yet.</Text>;
  return (
    <View style={styles.services}>
      {items.map((s) => (
        <View key={s.id} style={styles.service} accessible accessibilityLabel={`${s.name}, ${s.duration_minutes} minutes, ${s.fee.amount === 0 ? 'free' : s.fee.formatted}`}>
          <Text style={styles.body}>{s.name} · {s.duration_minutes} min</Text>
          <Text style={styles.fee}>{s.fee.amount === 0 ? 'Free' : s.fee.formatted}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    body: { ...typography.body, color: c.textPrimary, flexShrink: 1 },
    meta: { ...typography.small, color: c.textMuted },
    services: { gap: space[2] },
    service: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
    fee: { ...typography.label, color: c.textPrimary },
    times: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
    time: { ...typography.label, color: c.textPrimary, paddingVertical: space[1], paddingHorizontal: space[3], borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
  });
