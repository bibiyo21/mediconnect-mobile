import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Card, LinkButton, Notice, Screen, StateView } from '@/components/ui';
import { BOOKING_NOTICE, DAYS, fetchClinic, fetchClinicDoctors } from '@/features/directory/api';
import { userMessage } from '@/lib/errors';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** A clinic's public page: branches, hours, services and doctors (read only). */
export default function DirectoryClinic() {
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const clinic = useQuery({ queryKey: ['directory-clinic', id], queryFn: () => fetchClinic(id) });
  const doctors = useQuery({ queryKey: ['directory-clinic-doctors', id], queryFn: () => fetchClinicDoctors(id) });

  if (clinic.isPending) return <Screen title="Clinic"><StateView state="loading" message="Loading clinic" /></Screen>;
  if (clinic.isError) return <Screen title="Clinic"><StateView state="error" message={userMessage(clinic.error)} onRetry={() => clinic.refetch()} /></Screen>;
  const c = clinic.data;

  return (
    <Screen title={c.name} subtitle={c.description ?? c.organization_name}>
      <Notice tone="info" message={BOOKING_NOTICE} />
      {c.locations.map((l) => {
        const here = (doctors.data ?? []).filter((d) => d.location_ids.includes(l.id));
        return (
          <Card key={l.id} title={l.name}>
            <Text style={styles.body}>{[l.address_line1, l.barangay, l.city].filter(Boolean).join(', ')}</Text>
            {l.phone ? <Text style={styles.meta}>Phone: {l.phone}</Text> : null}
            <View style={styles.hours} accessibilityLabel="Opening hours">
              {DAYS.map((day, i) => {
                const ranges = l.operating_hours.filter((h) => h.day_of_week === i + 1).map((h) => `${h.opens_at}–${h.closes_at}`);
                return (
                  <View key={day} style={styles.hourRow}>
                    <Text style={styles.day}>{day}</Text>
                    <Text style={styles.meta}>{ranges.length ? ranges.join(', ') : 'Closed'}</Text>
                  </View>
                );
              })}
            </View>
            {here.length ? <Text style={styles.label}>Doctors here</Text> : null}
            {here.map((d) => <LinkButton key={d.id} label={`${d.display_name}${d.primary_specialty ? `, ${d.primary_specialty}` : ''}`} onPress={() => router.push(`/directory/doctor/${d.id}`)} />)}
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
    label: { ...typography.label, color: c.textPrimary },
    hours: { gap: space[1] },
    hourRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
    day: { ...typography.small, color: c.textPrimary },
  });
