import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, LinkButton, Notice, Screen, StateView } from '@/components/ui';
import { fetchMe, signOut } from '@/features/auth/api';
import { userMessage } from '@/lib/errors';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

function Row({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
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
          <LinkButton label={me.data.email ? 'Change email address' : 'Add an email address'} onPress={() => router.push({ pathname: '/contact', params: { kind: 'email' } })} />
          <Row label="Mobile" value={me.data.mobile_masked ? `${me.data.mobile_masked}${me.data.mobile_verified ? ' (verified)' : ' (not verified)'}` : 'Not added'} />
          <LinkButton label={me.data.mobile_masked ? 'Change mobile number' : 'Add a mobile number'} onPress={() => router.push({ pathname: '/contact', params: { kind: 'mobile' } })} />
          <Button label="Edit profile" variant="secondary" onPress={() => router.push('/profile')} />
        </Card>
      ) : null}
      <Card title="Family">
        <Button label="Family members" variant="secondary" onPress={() => router.push('/family')} />
      </Card>
      <Card title="Security">
        <Button label="Signed-in devices" variant="secondary" onPress={() => router.push('/devices')} />
        <LinkButton label="Delete my account" onPress={() => router.push('/delete-account')} />
      </Card>
      {logout.isError ? <Notice tone="error" message="You are signed out on this device. We could not reach the server to end the session there." /> : null}
      <Button label="Sign out" variant="danger" onPress={() => logout.mutate()} loading={logout.isPending} />
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    row: { gap: space[1], paddingVertical: space[1] },
    label: { ...typography.small, color: c.textMuted },
    value: { ...typography.body, color: c.textPrimary },
  });
