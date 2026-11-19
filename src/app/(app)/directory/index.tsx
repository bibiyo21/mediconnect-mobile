import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Notice, Screen, StateView, TextField } from '@/components/ui';
import { BOOKING_NOTICE, fetchDoctors } from '@/features/directory/api';
import { userMessage } from '@/lib/errors';
import { radius, space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** Browse verified doctors (increment 2.11). Search and ranking arrive with Phase 3. */
export default function Directory() {
  const styles = useThemedStyles(createStyles);
  const [city, setCity] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(1);
  const doctors = useQuery({ queryKey: ['directory', applied, page], queryFn: () => fetchDoctors(page, applied) });

  return (
    <Screen title="Doctors" subtitle="Every doctor here had their PRC licence and documents checked by a MediConnect reviewer.">
      <Notice tone="info" message={BOOKING_NOTICE} />
      <Card>
        <TextField label="City" placeholder="For example Makati" value={city} onChangeText={setCity} />
        <Button label="Show doctors" variant="secondary" onPress={() => { setPage(1); setApplied(city); }} />
      </Card>
      {doctors.isPending ? <StateView state="loading" message="Loading doctors" /> : null}
      {doctors.isError ? <StateView state="error" message={userMessage(doctors.error)} onRetry={() => doctors.refetch()} /> : null}
      {doctors.data && doctors.data.doctors.length === 0 ? <StateView state="empty" message="No doctors match yet." /> : null}
      <View role="list" style={styles.list}>
        {doctors.data?.doctors.map((d) => (
          <View key={d.id} role="listitem">
          <Pressable role="link" accessibilityLabel={`${d.display_name}${d.primary_specialty ? `, ${d.primary_specialty}` : ''}`} onPress={() => router.push(`/directory/doctor/${d.id}`)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Text style={styles.name}>{d.display_name}</Text>
            <Text style={styles.meta}>{[d.professional_title, d.primary_specialty].filter(Boolean).join(' · ') || 'Doctor'}</Text>
            <Text style={styles.meta}>{d.practice_locations.length ? d.practice_locations.map((l) => `${l.clinic_name}, ${l.city}`).join(' · ') : 'Online consultations'}</Text>
          </Pressable>
          </View>
        ))}
      </View>
      {doctors.data?.meta && doctors.data.meta.last_page > 1 ? (
        <View style={styles.pager}>
          <Button label="Previous page" variant="secondary" disabled={page <= 1} onPress={() => setPage(page - 1)} />
          <Button label="Next page" variant="secondary" disabled={page >= doctors.data.meta.last_page} onPress={() => setPage(page + 1)} />
        </View>
      ) : null}
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    list: { gap: space[3] },
    item: { gap: space[1], padding: space[4], borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.surface },
    pressed: { backgroundColor: c.primarySoft },
    name: { ...typography.label, color: c.primary },
    meta: { ...typography.small, color: c.textSecondary },
    pager: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  });
