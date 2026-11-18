import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text } from 'react-native';
import { Card, Notice, Screen } from '@/components/ui';
import { fetchMe } from '@/features/auth/api';
import { colors, typography } from '@/theme/tokens';

/**
 * Home shell. Each card names a feature that arrives with a later phase; none
 * of them calls an endpoint that does not exist yet (development-roadmap.md).
 */
const UPCOMING = [
  { title: 'Find a doctor', body: 'Search by specialty, location, HMO and availability.', phase: 'Phase 3' },
  { title: 'Appointments', body: 'Book clinic visits and online consultations.', phase: 'Phases 4–6' },
  { title: 'Clinic walk-ins', body: 'Join a clinic queue and follow your place in line.', phase: 'Phase 5' },
  { title: 'HMO memberships', body: 'Save your HMO card details for faster booking.', phase: 'Phase 7' },
] as const;

export default function Home() {
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const name = me.data?.profile?.first_name;

  return (
    <Screen topInset title={name ? `Hello, ${name}` : 'Hello'} subtitle="Welcome to MediConnect.">
      <Notice tone="warning" message="In an emergency, call 911 or go to the nearest emergency room. MediConnect is not for emergencies." />
      {UPCOMING.map((item) => (
        <Card key={item.title} title={item.title}>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.soon}>Coming soon</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, color: colors.text },
  soon: { ...typography.small, color: colors.muted },
});
