import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Button, Card, Screen, StateView } from '@/components/ui';
import { fetchDependents } from '@/features/patients/api';
import { relationshipLabel } from '@/features/patients/DependentFormFields';
import { userMessage } from '@/lib/errors';
import { typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

/** Family members (dependents) the signed-in patient manages care for. */
export default function Family() {
  const styles = useThemedStyles(createStyles);
  const dependents = useQuery({ queryKey: ['dependents'], queryFn: fetchDependents });

  return (
    <Screen title="Family members" subtitle="People whose care you manage, such as your children. You can book for them once booking is available.">
      {dependents.isPending ? <StateView state="loading" message="Loading family members" /> : null}
      {dependents.isError ? <StateView state="error" message={userMessage(dependents.error)} onRetry={() => dependents.refetch()} /> : null}
      {dependents.data?.length === 0 ? <StateView state="empty" message="You have not added any family members yet." /> : null}
      {dependents.data?.map((d) => (
        <Card key={d.id} title={[d.first_name, d.last_name].join(' ')}>
          <Text style={styles.meta}>
            {relationshipLabel(d.relationship)}
            {d.date_of_birth ? ` · born ${d.date_of_birth}` : ''}
          </Text>
          <Button label="Edit" variant="secondary" accessibilityHint={`Edit ${d.first_name}'s details`} onPress={() => router.push({ pathname: '/family/[id]', params: { id: d.id } })} />
        </Card>
      ))}
      <Button label="Add a family member" onPress={() => router.push('/family/new')} />
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    meta: { ...typography.small, color: c.textMuted },
  });
