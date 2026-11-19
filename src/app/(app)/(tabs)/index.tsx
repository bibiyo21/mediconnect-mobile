import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { BrandIcon, Card, Notice, Screen, type BrandIconName } from '@/components/ui';
import { fetchMe } from '@/features/auth/api';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/**
 * Home shell. Each card names a feature that arrives with a later phase; none
 * of them calls an endpoint that does not exist yet (development-roadmap.md).
 */
const UPCOMING: readonly { icon: BrandIconName; title: string; body: string; phase: string }[] = [
  { icon: 'find-a-doctor', title: 'Find a doctor', body: 'Search by specialty, location, HMO and availability.', phase: 'Phase 3' },
  { icon: 'book-appointment', title: 'Appointments', body: 'Book clinic visits and online consultations.', phase: 'Phases 4–6' },
  { icon: 'hospitals-clinics', title: 'Clinic walk-ins', body: 'Join a clinic queue and follow your place in line.', phase: 'Phase 5' },
  { icon: 'hmo-coverage', title: 'HMO memberships', body: 'Save your HMO card details for faster booking.', phase: 'Phase 7' },
];

export default function Home() {
  const styles = useThemedStyles(createStyles);
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const name = me.data?.profile?.first_name;

  return (
    <Screen topInset title={name ? `Hello, ${name}` : 'Hello'} subtitle="Welcome to MediConnect.">
      <Notice tone="warning" message="In an emergency, call 911 or go to the nearest emergency room. MediConnect is not for emergencies." />
      <Card title="Coming soon to MediConnect">
        <Text style={styles.soon}>Your account is ready. These features are on the way:</Text>
        {UPCOMING.map((item) => (
          <View key={item.title} style={styles.item} accessible accessibilityLabel={`${item.title}. ${item.body}`}>
            <BrandIcon name={item.icon} size={40} />
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    body: { ...typography.body, color: c.textPrimary },
    soon: { ...typography.body, color: c.textSecondary },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingTop: space[3] },
    itemText: { flex: 1, gap: space[1] },
    itemTitle: { ...typography.label, color: c.textPrimary },
  });
