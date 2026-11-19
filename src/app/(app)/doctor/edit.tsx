import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { Button, Card, Checkbox, ChoiceGroup, Notice, Screen, StateView, TextField } from '@/components/ui';
import { fetchMyDoctorProfile, fetchSpecialties, updateMyDoctorProfile } from '@/features/doctors/api';
import { toForm, toUpdate } from '@/features/doctors/mapping';
import { userMessage } from '@/lib/errors';
import { applyServerErrors } from '@/lib/forms';
import { doctorProfileSchema, type DoctorProfileForm } from '@/lib/validation';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fil', label: 'Filipino' },
  { code: 'ceb', label: 'Cebuano' },
  { code: 'ilo', label: 'Ilocano' },
  { code: 'hil', label: 'Hiligaynon' },
  { code: 'zh', label: 'Chinese' },
] as const;

const GENDERS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'OTHER', label: 'Other' },
] as const;

const FIELD_MAP: Record<string, Path<DoctorProfileForm>> = {
  display_name: 'display_name', professional_title: 'professional_title', biography: 'biography', prc_license_number: 'prc_license_number',
  medical_school: 'medical_school', years_experience: 'years_experience', gender: 'gender', languages: 'languages', specialties: 'primary_specialty_id',
};

export default function EditDoctorProfile() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['doctor-profile'], queryFn: fetchMyDoctorProfile });
  const specialties = useQuery({ queryKey: ['specialties'], queryFn: fetchSpecialties, staleTime: 6 * 3600_000 });
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, reset, formState } = useForm<DoctorProfileForm>({ resolver: zodResolver(doctorProfileSchema) });

  useEffect(() => {
    if (profile.data) reset(toForm(profile.data));
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: (form: DoctorProfileForm) => updateMyDoctorProfile(toUpdate(form, profile.data!)),
    onSuccess: (updated) => {
      queryClient.setQueryData(['doctor-profile'], updated);
      if (router.canGoBack()) router.back();
      else router.replace('/doctor');
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, FIELD_MAP)),
  });

  if (profile.isPending || specialties.isPending) return <Screen title="Doctor profile"><StateView state="loading" message="Loading" /></Screen>;
  if (profile.isError || specialties.isError) return <Screen title="Doctor profile"><StateView state="error" message={userMessage(profile.error ?? specialties.error)} onRetry={() => { profile.refetch(); specialties.refetch(); }} /></Screen>;

  const locked = profile.data.licence_locked;
  const errors = formState.errors;
  const submit = handleSubmit((v) => {
    setFormError(null);
    save.mutate(v);
  });

  return (
    <Screen title="Edit doctor profile" subtitle="Patients see this once you are verified. Keep it factual.">
      {formError ? <Notice tone="error" message={formError} /> : null}
      <Card title="About you">
        <Controller control={control} name="display_name" render={({ field }) => <TextField label="Name patients will see" value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.display_name?.message} />} />
        <Controller control={control} name="professional_title" render={({ field }) => <TextField label="Title (optional)" hint="For example MD, FPCP" value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.professional_title?.message} />} />
        <Controller control={control} name="biography" render={({ field }) => <TextField label="About your practice (optional)" hint="At least 50 characters helps patients choose." multiline numberOfLines={4} value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.biography?.message} />} />
        <Controller control={control} name="gender" render={({ field }) => <ChoiceGroup label="Gender (optional, shown to patients)" options={GENDERS} value={field.value ?? ''} onChange={field.onChange} />} />
      </Card>

      <Card title="Licence and training">
        <Controller control={control} name="prc_license_number" render={({ field }) => (
          <TextField
            label="PRC licence number"
            hint={locked ? `Locked while under review or after verification (${profile.data.prc_license_number_masked ?? ''}). Contact support to change it.` : profile.data.prc_license_number_masked ? `Saved as ${profile.data.prc_license_number_masked}. Enter it again only to change it.` : 'Digits only. Kept encrypted and never shown to patients.'}
            keyboardType="number-pad"
            maxLength={10}
            editable={!locked}
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.prc_license_number?.message}
          />
        )} />
        <Controller control={control} name="medical_school" render={({ field }) => <TextField label="Medical school (optional)" value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.medical_school?.message} />} />
        <Controller control={control} name="years_experience" render={({ field }) => <TextField label="Years in practice (optional)" keyboardType="number-pad" maxLength={2} value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.years_experience?.message} />} />
      </Card>

      <Card title="Main specialty">
        <Controller control={control} name="primary_specialty_id" render={({ field }) => (
          <ChoiceGroup label="Choose one" options={specialties.data.map((s) => ({ value: s.id, label: s.name }))} value={field.value ?? ''} onChange={field.onChange} error={errors.primary_specialty_id?.message} />
        )} />
      </Card>

      <Card title="Languages you consult in">
        <Controller control={control} name="languages" render={({ field }) => (
          <>
            {LANGUAGES.map((l) => (
              <Checkbox key={l.code} checked={(field.value ?? []).includes(l.code)} accessibilityLabel={l.label} label={l.label}
                onChange={(on) => field.onChange(on ? [...(field.value ?? []), l.code] : (field.value ?? []).filter((c) => c !== l.code))} />
            ))}
          </>
        )} />
      </Card>

      <Button label="Save doctor profile" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}
