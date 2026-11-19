import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Card, LinkButton, Notice, Screen, StateView } from '@/components/ui';
import { BOOKING_NOTICE, fetchDoctor, fetchDoctorServices, languageName, type PublicService } from '@/features/directory/api';
import { userMessage } from '@/lib/errors';
import { space, typography } from '@/theme/tokens';
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
      <Text style={styles.meta}>Fees are set by the doctor. HMO coverage is confirmed by the clinic, never assumed.</Text>
    </Screen>
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
  });
