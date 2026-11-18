import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { Button, Card, ChoiceGroup, Notice, Screen, StateView, TextField } from '@/components/ui';
import { fetchMyProfile, toForm, updateMyProfile } from '@/features/patients/api';
import { birthDateAutoComplete } from '@/lib/device';
import { userMessage } from '@/lib/errors';
import { applyServerErrors } from '@/lib/forms';
import { formatDateInput, profileSchema, type ProfileForm } from '@/lib/validation';

const SEX_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'OTHER', label: 'Other' },
] as const;

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fil', label: 'Filipino' },
] as const;

/** Server field names (including nested ones) → form fields. */
const FIELD_MAP: Record<string, Path<ProfileForm>> = {
  first_name: 'first_name',
  middle_name: 'middle_name',
  last_name: 'last_name',
  date_of_birth: 'date_of_birth',
  sex: 'sex',
  preferred_language: 'preferred_language',
  'emergency_contact.name': 'emergency_name',
  'emergency_contact.phone': 'emergency_phone',
  'address.line1': 'line1',
  'address.line2': 'line2',
  'address.barangay': 'barangay',
  'address.city': 'city',
  'address.province': 'province',
  'address.postal_code': 'postal_code',
};

const EMPTY: ProfileForm = {
  first_name: '', middle_name: '', last_name: '', date_of_birth: '', sex: '', preferred_language: 'en',
  emergency_name: '', emergency_phone: '', line1: '', line2: '', barangay: '', city: '', province: '', postal_code: '',
};

export default function EditProfile() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['patient-profile'], queryFn: fetchMyProfile });
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, reset, formState } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (profile.data) reset(toForm(profile.data));
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(['patient-profile'], updated);
      // The account summary shows the name from /auth/me.
      queryClient.invalidateQueries({ queryKey: ['me'] });
      // Opened directly (a web refresh or link) there is no screen to go back to.
      if (router.canGoBack()) router.back();
      else router.replace('/account');
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, FIELD_MAP)),
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    save.mutate(values);
  });

  if (profile.isPending) {
    return (
      <Screen title="Your profile">
        <StateView state="loading" message="Loading your profile" />
      </Screen>
    );
  }
  if (profile.isError) {
    return (
      <Screen title="Your profile">
        <StateView state="error" message={userMessage(profile.error)} onRetry={() => profile.refetch()} />
      </Screen>
    );
  }

  const errors = formState.errors;
  const text = (name: Path<ProfileForm>, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          label={label}
          value={String(field.value ?? '')}
          onChangeText={name === 'date_of_birth' ? (v) => field.onChange(formatDateInput(v)) : field.onChange}
          onBlur={field.onBlur}
          error={errors[name]?.message}
          {...extra}
        />
      )}
    />
  );

  return (
    <Screen title="Your profile" subtitle="Use your name as it appears on your ID. Doctors and HMOs will see it.">
      {formError ? <Notice tone="error" message={formError} /> : null}
      <Card title="Personal details">
        {text('first_name', 'First name', { autoComplete: 'given-name', textContentType: 'givenName' })}
        {text('middle_name', 'Middle name (optional)', { autoComplete: 'additional-name', textContentType: 'middleName' })}
        {text('last_name', 'Last name', { autoComplete: 'family-name', textContentType: 'familyName' })}
        {text('date_of_birth', 'Date of birth', { hint: 'Year, month, day. For example 1990-05-17.', placeholder: 'YYYY-MM-DD', keyboardType: 'number-pad', maxLength: 10, autoComplete: birthDateAutoComplete })}
        <Controller
          control={control}
          name="sex"
          render={({ field }) => <ChoiceGroup label="Sex (optional)" options={SEX_OPTIONS} value={field.value} onChange={field.onChange} error={errors.sex?.message} />}
        />
        <Controller
          control={control}
          name="preferred_language"
          render={({ field }) => <ChoiceGroup label="Preferred language" options={LANGUAGE_OPTIONS} value={field.value} onChange={field.onChange} error={errors.preferred_language?.message} />}
        />
      </Card>
      <Card title="Emergency contact (optional)">
        {text('emergency_name', 'Name', { autoComplete: 'name' })}
        {text('emergency_phone', 'Mobile number', { hint: 'For example 0917 123 4567', keyboardType: 'phone-pad', autoComplete: 'tel' })}
      </Card>
      <Card title="Address (optional)">
        {text('line1', 'House number and street', { autoComplete: 'address-line1' })}
        {text('line2', 'Building, unit or subdivision (optional)', { autoComplete: 'address-line2' })}
        {text('barangay', 'Barangay (optional)')}
        {text('city', 'City or municipality')}
        {text('province', 'Province (optional)')}
        {text('postal_code', 'Postal code (optional)', { keyboardType: 'number-pad', maxLength: 4, autoComplete: 'postal-code' })}
      </Card>
      <Button label="Save changes" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
