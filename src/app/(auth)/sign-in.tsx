import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Notice, Screen, TextField } from '@/components/ui';
import { signIn } from '@/features/auth/api';
import { useRegistrationDraft } from '@/features/auth/RegistrationDraft';
import { applyServerErrors } from '@/lib/forms';
import { signInSchema, type SignInForm } from '@/lib/validation';

export default function SignIn() {
  const [formError, setFormError] = useState<string | null>(null);
  const { update } = useRegistrationDraft();
  const { control, handleSubmit, setError, formState } = useForm<SignInForm>({ resolver: zodResolver(signInSchema), defaultValues: { identifier: '', password: '' } });

  const mutation = useMutation({
    mutationFn: (values: SignInForm) => signIn(values.identifier, values.password),
    onSuccess: (result) => {
      if (result.kind === 'mfaRequired') {
        update({ mfaChallengeId: result.challengeId });
        router.push('/mfa');
      }
      if (result.kind === 'mfaSetupRequired') setFormError('This account needs two-step verification set up, which is not available in the patient app.');
      // signedIn: the root navigator switches to the app.
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, { identifier: 'identifier', password: 'password' })),
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <Screen title="Welcome back" subtitle="Sign in with your email address or mobile number.">
      {formError ? <Notice tone="error" message={formError} /> : null}
      <Controller
        control={control}
        name="identifier"
        render={({ field }) => (
          <TextField
            label="Email or mobile number"
            autoCapitalize="none"
            autoComplete="username"
            textContentType="username"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.identifier?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={() => submit()}
            error={formState.errors.password?.message}
          />
        )}
      />
      <Button label="Sign in" onPress={submit} loading={mutation.isPending} />
      <Notice message="Forgot your password? Password reset in the app is coming soon." />
    </Screen>
  );
}
