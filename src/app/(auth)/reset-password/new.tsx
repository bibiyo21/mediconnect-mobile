import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Notice, ResendCodeButton, Screen, TextField } from '@/components/ui';
import { requestPasswordResetCode, resetPassword } from '@/features/auth/api';
import { useRegistrationDraft } from '@/features/auth/RegistrationDraft';
import { applyServerErrors } from '@/lib/forms';
import { newPasswordSchema, type NewPasswordForm } from '@/lib/validation';

const FIELD_MAP = { code: 'code', password: 'password', password_confirmation: 'password_confirmation', verification_token: 'code' } as const;

/** Step 2 of 2: the code and the new password on one screen. */
export default function ResetPasswordNew() {
  const { draft, update } = useRegistrationDraft();
  const [formError, setFormError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const { control, handleSubmit, setError, formState } = useForm<NewPasswordForm>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { code: '', password: '', password_confirmation: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: NewPasswordForm) =>
      resetPassword({ contact: draft.resetContact ?? '', challengeId: draft.resetChallenge?.challenge_id ?? '', ...values }),
    onSuccess: () => {
      update({ resetChallenge: undefined, signInNotice: 'Your password was changed. Sign in with your new password. Other devices were signed out.' });
      router.dismissTo('/sign-in');
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, FIELD_MAP)),
  });

  const resend = useMutation({
    mutationFn: () => requestPasswordResetCode(draft.resetContact ?? ''),
    onSuccess: (challenge) => {
      update({ resetChallenge: challenge });
      setResent(true);
      setFormError(null);
    },
    onError: (error) => setFormError(applyServerErrors(error, setError)),
  });

  if (!draft.resetChallenge || !draft.resetContact) {
    return (
      <Screen title="Reset your password">
        <Notice tone="error" message="This reset has expired. Start again to get a new code." />
        <Button label="Start again" onPress={() => router.replace('/reset-password')} />
      </Screen>
    );
  }

  const submit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  const errors = formState.errors;
  return (
    <Screen title="Choose a new password" subtitle={`If ${draft.resetChallenge.destination_masked} belongs to an account, we sent a 6-digit code to it.`}>
      {formError ? <Notice tone="error" message={formError} /> : null}
      {resent ? <Notice tone="success" message="A new code is on its way." /> : null}
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="6-digit code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.code?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="New password"
            hint="At least 10 characters, with letters and numbers."
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password_confirmation"
        render={({ field }) => (
          <TextField
            label="Confirm new password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={() => submit()}
            error={errors.password_confirmation?.message}
          />
        )}
      />
      <Button label="Change password" onPress={submit} loading={mutation.isPending} />
      <ResendCodeButton onResend={() => resend.mutate()} loading={resend.isPending} />
    </Screen>
  );
}
