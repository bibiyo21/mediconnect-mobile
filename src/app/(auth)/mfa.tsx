import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Notice, Screen, TextField } from '@/components/ui';
import { completeMfa } from '@/features/auth/api';
import { useRegistrationDraft } from '@/features/auth/RegistrationDraft';
import { applyServerErrors } from '@/lib/forms';
import { mfaSchema, type CodeForm } from '@/lib/validation';

export default function Mfa() {
  const { draft } = useRegistrationDraft();
  const challenge = draft.mfaChallengeId;
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<CodeForm>({ resolver: zodResolver(mfaSchema), defaultValues: { code: '' } });

  const mutation = useMutation({
    mutationFn: (values: CodeForm) => completeMfa(challenge ?? '', values.code),
    onSuccess: (result) => {
      if (result.kind === 'mfaSetupRequired') setFormError('This account needs two-step verification set up, which is not available in the patient app.');
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, { code: 'code' })),
  });

  if (!challenge) {
    return (
      <Screen title="Two-step verification">
        <Notice tone="error" message="This sign-in has expired. Please sign in again." />
        <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  const submit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <Screen title="Two-step verification" subtitle="Enter the 6-digit code from your authenticator app.">
      {formError ? <Notice tone="error" message={formError} /> : null}
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Authentication code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            value={field.value}
            onChangeText={field.onChange}
            onSubmitEditing={() => submit()}
            error={formState.errors.code?.message}
          />
        )}
      />
      <Button label="Verify" onPress={submit} loading={mutation.isPending} />
    </Screen>
  );
}
