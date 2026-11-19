import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Checkbox, Notice, Screen, TextField } from '@/components/ui';
import { startDoctorOnboarding } from '@/features/doctors/api';
import { applyServerErrors } from '@/lib/forms';
import { doctorStartSchema, type DoctorStartForm } from '@/lib/validation';

/** Start doctor onboarding. The patient account and profile stay as they are (D-16). */
export default function StartDoctor() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<DoctorStartForm>({ resolver: zodResolver(doctorStartSchema), defaultValues: { display_name: '', professional_title: '', confirm_licensed: false } });

  const start = useMutation({
    mutationFn: (v: DoctorStartForm) => startDoctorOnboarding(v.display_name, v.professional_title || null),
    onSuccess: (profile) => {
      queryClient.setQueryData(['doctor-profile'], profile);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.replace('/doctor');
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, { display_name: 'display_name', professional_title: 'professional_title', confirm_licensed: 'confirm_licensed' })),
  });

  const submit = handleSubmit((v) => {
    setFormError(null);
    start.mutate(v);
  });

  return (
    <Screen title="Register as a doctor" subtitle="Patients will only see you after MediConnect verifies your PRC licence. Your patient account stays the same.">
      {formError ? <Notice tone="error" message={formError} /> : null}
      <Controller control={control} name="display_name" render={({ field }) => (
        <TextField label="Name patients will see" hint="For example Dr. Ana Santos" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.display_name?.message} />
      )} />
      <Controller control={control} name="professional_title" render={({ field }) => (
        <TextField label="Title (optional)" hint="For example MD, FPCP" value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} error={formState.errors.professional_title?.message} />
      )} />
      <Controller control={control} name="confirm_licensed" render={({ field }) => (
        <Checkbox
          checked={field.value}
          onChange={field.onChange}
          accessibilityLabel="I am a physician licensed by the Professional Regulation Commission"
          label="I am a physician licensed by the Professional Regulation Commission (PRC). I understand MediConnect will verify my licence before patients can book me."
          error={formState.errors.confirm_licensed?.message}
        />
      )} />
      <Button label="Start registration" onPress={submit} loading={start.isPending} />
    </Screen>
  );
}
