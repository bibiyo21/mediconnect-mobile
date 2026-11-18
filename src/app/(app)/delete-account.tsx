import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';
import { Button, Card, Checkbox, Notice, Screen, TextField } from '@/components/ui';
import { requestAccountDeletion } from '@/features/auth/api';
import { applyServerErrors } from '@/lib/forms';
import { space, typography } from '@/theme/tokens';
import { useThemedStyles, type ThemeColors } from '@/theme/useTheme';

const schema = z.object({
  understood: z.boolean().refine((v) => v, 'Confirm that you understand what happens to your account.'),
  current_password: z.string().min(1, 'Enter your password.'),
});
type Form = z.infer<typeof schema>;

/**
 * Delete account (D-38; App Store guideline 5.1.1(v)). The request signs out
 * every device; signing in within 30 days cancels it.
 */
export default function DeleteAccount() {
  const styles = useThemedStyles(createStyles);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { understood: false, current_password: '' } });

  const request = useMutation({
    mutationFn: (values: Form) => requestAccountDeletion(values.current_password),
    // On success the session ends and the welcome screen shows the deletion date.
    onError: (error) => setFormError(applyServerErrors(error, setError, { current_password: 'current_password', account: 'understood' })),
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    request.mutate(values);
  });

  return (
    <Screen title="Delete your account">
      <Card title="What happens">
        <Text style={styles.item}>• You are signed out on every device right away.</Text>
        <Text style={styles.item}>• Your account is deleted after 30 days. Signing in before then cancels the deletion.</Text>
        <Text style={styles.item}>• After that, your name, contact details, address and the family members only you manage are removed for good.</Text>
        <Text style={styles.item}>• Records the law requires us to keep, such as consent records, are kept without your contact details.</Text>
      </Card>
      {formError ? <Notice tone="error" message={formError} /> : null}
      <Controller
        control={control}
        name="understood"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            onChange={field.onChange}
            accessibilityLabel="I understand my account will be deleted after 30 days"
            label="I understand my account will be deleted after 30 days unless I sign in again."
            error={formState.errors.understood?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="current_password"
        render={({ field }) => (
          <TextField
            label="Password"
            hint="Enter your password to confirm it is you."
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.current_password?.message}
          />
        )}
      />
      <Button label="Delete my account" variant="danger" onPress={submit} loading={request.isPending} />
    </Screen>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    item: { ...typography.body, color: c.textPrimary, marginBottom: space[1] },
  });
