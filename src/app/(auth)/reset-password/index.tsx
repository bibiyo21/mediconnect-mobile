import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Notice, Screen, TextField } from '@/components/ui';
import { requestPasswordResetCode } from '@/features/auth/api';
import { useRegistrationDraft } from '@/features/auth/RegistrationDraft';
import { applyServerErrors } from '@/lib/forms';
import { contactSchema, type ContactForm } from '@/lib/validation';

/** Step 1 of 2: where to send the reset code. Pre-filled from the sign-in form. */
export default function ResetPasswordRequest() {
  const { draft, update } = useRegistrationDraft();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { contact: draft.resetContact ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ContactForm) => requestPasswordResetCode(values.contact),
    onSuccess: (challenge, values) => {
      update({ resetContact: values.contact.trim(), resetChallenge: challenge });
      router.push('/reset-password/new');
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, { email: 'contact', mobile: 'contact' })),
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <Screen title="Reset your password" subtitle="Enter the email address or mobile number you use to sign in. We will send you a 6-digit code.">
      {formError ? <Notice tone="error" message={formError} /> : null}
      <Controller
        control={control}
        name="contact"
        render={({ field }) => (
          <TextField
            label="Email or mobile number"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={() => submit()}
            error={formState.errors.contact?.message}
          />
        )}
      />
      <Button label="Send code" onPress={submit} loading={mutation.isPending} />
    </Screen>
  );
}
