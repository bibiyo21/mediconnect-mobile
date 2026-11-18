import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Notice, ResendCodeButton, Screen, TextField } from '@/components/ui';
import { requestRegistrationCode, verifyCode } from '@/features/auth/api';
import { useRegistrationDraft } from '@/features/auth/RegistrationDraft';
import { applyServerErrors } from '@/lib/forms';
import { codeSchema, type CodeForm } from '@/lib/validation';

export default function RegisterVerify() {
  const { draft, update } = useRegistrationDraft();
  const [formError, setFormError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const { control, handleSubmit, setError, formState, reset } = useForm<CodeForm>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  const verify = useMutation({
    mutationFn: (values: CodeForm) => verifyCode(draft.challenge?.challenge_id ?? '', values.code),
    onSuccess: (verificationToken) => {
      update({ verificationToken });
      router.push('/register/details');
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, { code: 'code' })),
  });

  const resend = useMutation({
    mutationFn: () => requestRegistrationCode(draft.contact ?? ''),
    onSuccess: (challenge) => {
      update({ challenge });
      reset();
      setResent(true);
      setFormError(null);
    },
    onError: (error) => setFormError(applyServerErrors(error, setError)),
  });

  if (!draft.challenge || !draft.contact) {
    return (
      <Screen title="Verify">
        <Notice tone="error" message="Start again to get a new code." />
        <Button label="Start again" onPress={() => router.replace('/register/contact')} />
      </Screen>
    );
  }

  const submit = handleSubmit((values) => {
    setFormError(null);
    verify.mutate(values);
  });

  return (
    <Screen title="Enter your code" subtitle={`Step 2 of 3. If ${draft.challenge.destination_masked} can receive a code, we have sent one. It expires in a few minutes.`}>
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
            onSubmitEditing={() => submit()}
            error={formState.errors.code?.message}
          />
        )}
      />
      <Button label="Verify" onPress={submit} loading={verify.isPending} />
      <ResendCodeButton onResend={() => resend.mutate()} loading={resend.isPending} />
    </Screen>
  );
}
