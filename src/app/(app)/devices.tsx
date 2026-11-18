import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text } from 'react-native';
import { Button, Card, Notice, Screen, StateView } from '@/components/ui';
import { fetchDevices, signOutDevice, type Device } from '@/features/auth/api';
import { userMessage } from '@/lib/errors';
import { colors, typography } from '@/theme/tokens';

const PLATFORM: Record<Device['platform'], string> = { IOS: 'iPhone', ANDROID: 'Android', WEB: 'Web browser' };

function formatDate(iso: string | null): string {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
}

export default function Devices() {
  const queryClient = useQueryClient();
  const devices = useQuery({ queryKey: ['devices'], queryFn: fetchDevices });
  const revoke = useMutation({
    mutationFn: signOutDevice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  return (
    <Screen title="Signed-in devices" subtitle="Sign out any device you do not recognise.">
      {revoke.isError ? <Notice tone="error" message={userMessage(revoke.error)} /> : null}
      {devices.isPending ? <StateView state="loading" message="Loading devices" /> : null}
      {devices.isError ? <StateView state="error" message={userMessage(devices.error)} onRetry={() => devices.refetch()} /> : null}
      {devices.data?.length === 0 ? <StateView state="empty" message="No other devices are signed in." /> : null}
      {devices.data?.map((device) => (
        <Card key={device.id} title={device.device_name ?? PLATFORM[device.platform] ?? 'Device'}>
          <Text style={styles.meta}>
            {PLATFORM[device.platform] ?? device.platform}
            {device.app_version ? ` · app ${device.app_version}` : ''}
          </Text>
          <Text style={styles.meta}>Last active: {formatDate(device.last_seen_at)}</Text>
          {device.current ? (
            <Text style={styles.current}>This device</Text>
          ) : (
            <Button
              label="Sign out this device"
              variant="danger"
              accessibilityHint={`Signs out ${device.device_name ?? 'this device'}`}
              loading={revoke.isPending && revoke.variables === device.id}
              onPress={() => revoke.mutate(device.id)}
            />
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { ...typography.small, color: colors.muted },
  current: { ...typography.label, color: colors.success },
});
