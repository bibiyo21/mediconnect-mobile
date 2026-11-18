import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Notice, Screen, StateView } from '@/components/ui';
import { fetchMe, signOut } from '@/features/auth/api';
import { userMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme/tokens';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function Account() {
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const logout = useMutation({ mutationFn: signOut });

  return (
    <Screen topInset title="Account">
      {me.isPending ? <StateView state="loading" message="Loading your account" /> : null}
      {me.isError ? <StateView state="error" message={userMessage(me.error)} onRetry={() => me.refetch()} /> : null}
      {me.data ? (
        <Card title="Your details">
          <Row label="Name" value={[me.data.profile?.first_name, me.data.profile?.middle_name, me.data.profile?.last_name].filter(Boolean).join(' ') || 'Not set'} />
          <Row label="Email" value={me.data.email ? `${me.data.email}${me.data.email_verified ? ' (verified)' : ' (not verified)'}` : 'Not added'} />
          <Row label="Mobile" value={me.data.mobile_masked ? `${me.data.mobile_masked}${me.data.mobile_verified ? ' (verified)' : ' (not verified)'}` : 'Not added'} />
          <Text style={styles.note}>Editing your profile and adding dependents arrive in a later update.</Text>
        </Card>
      ) : null}
      <Card title="Security">
        <Button label="Signed-in devices" variant="secondary" onPress={() => router.push('/devices')} />
      </Card>
      {logout.isError ? <Notice tone="error" message="You are signed out on this device. We could not reach the server to end the session there." /> : null}
      <Button label="Sign out" variant="danger" onPress={() => logout.mutate()} loading={logout.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: spacing.xs },
  label: { ...typography.small, color: colors.muted },
  value: { ...typography.body, color: colors.text },
  note: { ...typography.small, color: colors.muted },
});
