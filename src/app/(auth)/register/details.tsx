import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text } from 'react-native';
import { Button, Checkbox, Notice, Screen, TextField } from '@/components/ui';
import { register } from '@/features/auth/api';
import { useRegistrationDraft } from '@/features/auth/RegistrationDraft';
import { LEGAL_VERSIONS } from '@/lib/config';
import { birthDateAutoComplete } from '@/lib/device';
import { applyServerErrors } from '@/lib/forms';
import { detailsSchema, formatDateInput, type DetailsForm } from '@/lib/validation';
import { typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const FIELD_MAP = {
  first_name: 'first_name',
  middle_name: 'middle_name',
  last_name: 'last_name',
  date_of_birth: 'date_of_birth',
  password: 'password',
  password_confirmation: 'password_confirmation',
  accept_terms_version: 'accept_terms',
  accept_privacy_notice_version: 'accept_terms',
} as const;

export default function RegisterDetails() {
  const { colors } = useTheme();
  const { draft, reset } = useRegistrationDraft();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { first_name: '', middle_name: '', last_name: '', date_of_birth: '', password: '', password_confirmation: '', accept_terms: false },
  });

  const mutation = useMutation({
    mutationFn: (values: DetailsForm) => register({ ...values, contact: draft.contact ?? '', verificationToken: draft.verificationToken ?? '' }),
    onSuccess: (result) => {
      if (result.kind === 'signedIn') reset();
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, FIELD_MAP)),
  });

  if (!draft.verificationToken || !draft.contact) {
    return (
      <Screen title="Your details">
        <Notice tone="error" message="Your verification has expired. Start again to get a new code." />
        <Button label="Start again" onPress={() => router.replace('/register/contact')} />
      </Screen>
    );
  }

  const submit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  const errors = formState.errors;
  const text = (name: 'first_name' | 'middle_name' | 'last_name' | 'date_of_birth', label: string, extra: object = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <TextField label={label} value={field.value ?? ''} onChangeText={name === 'date_of_birth' ? (v) => field.onChange(formatDateInput(v)) : field.onChange} onBlur={field.onBlur} error={errors[name]?.message} {...extra} />}
    />
  );

  return (
    <Screen title="About you" subtitle="Step 3 of 3. Use your name as it appears on your ID; doctors and HMOs will see it.">
      {formError ? <Notice tone="error" message={formError} /> : null}
      {text('first_name', 'First name', { autoComplete: 'given-name', textContentType: 'givenName' })}
      {text('middle_name', 'Middle name (optional)', { autoComplete: 'additional-name', textContentType: 'middleName' })}
      {text('last_name', 'Last name', { autoComplete: 'family-name', textContentType: 'familyName' })}
      {text('date_of_birth', 'Date of birth', { hint: 'Year, month, day. For example 1990-05-17. You must be 18 or older.', placeholder: 'YYYY-MM-DD', autoComplete: birthDateAutoComplete, keyboardType: 'number-pad', maxLength: 10 })}
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Password"
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
            label="Confirm password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password_confirmation?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="accept_terms"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            onChange={field.onChange}
            accessibilityLabel="I agree to the Terms of Use and the Privacy Notice"
            error={errors.accept_terms?.message}
            label={
              <Text style={{ ...typography.body, color: colors.textPrimary }}>
                I agree to the Terms of Use and the Privacy Notice (version {LEGAL_VERSIONS.terms}).
              </Text>
            }
          />
        )}
      />
      <Notice message="The final Terms of Use and Privacy Notice are pending legal review and will be linked here." />
      <Button label="Create account" onPress={submit} loading={mutation.isPending} />
    </Screen>
  );
}
