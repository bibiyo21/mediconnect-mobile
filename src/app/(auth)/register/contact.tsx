import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, LinkButton, Notice, Screen, TextField } from '@/components/ui';
import { requestRegistrationCode } from '@/features/auth/api';
import { useRegistrationDraft } from '@/features/auth/RegistrationDraft';
import { applyServerErrors } from '@/lib/forms';
import { contactSchema, type ContactForm } from '@/lib/validation';

export default function RegisterContact() {
  const { draft, update } = useRegistrationDraft();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<ContactForm>({ resolver: zodResolver(contactSchema), defaultValues: { contact: draft.contact ?? '' } });

  const mutation = useMutation({
    mutationFn: (values: ContactForm) => requestRegistrationCode(values.contact),
    onSuccess: (challenge, values) => {
      update({ contact: values.contact.trim(), challenge, verificationToken: undefined });
      router.push('/register/verify');
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, { email: 'contact', mobile: 'contact' })),
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <Screen title="Create your account" subtitle="Step 1 of 3. We will send a 6-digit code to confirm it is yours.">
      {formError ? <Notice tone="error" message={formError} /> : null}
      <Controller
        control={control}
        name="contact"
        render={({ field }) => (
          <TextField
            label="Email or mobile number"
            hint="For example juan@example.com or 0917 123 4567"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={() => submit()}
            error={formState.errors.contact?.message}
          />
        )}
      />
      <Button label="Send code" onPress={submit} loading={mutation.isPending} />
      <LinkButton label="Already have an account? Sign in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
