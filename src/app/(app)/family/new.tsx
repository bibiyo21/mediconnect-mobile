import { zodResolver } from '@hookform/resolvers/zod';
import { newIdempotencyKey } from '@mediconnect/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { Button, Notice, Screen } from '@/components/ui';
import { addDependent } from '@/features/patients/api';
import { DependentFormFields } from '@/features/patients/DependentFormFields';
import { applyServerErrors } from '@/lib/forms';
import { dependentSchema, type DependentForm } from '@/lib/validation';

const addSchema = dependentSchema.refine((v) => v.guardian_attestation, { path: ['guardian_attestation'], message: "Confirm that you are authorised to manage this person's health information." });

const FIELD_MAP: Record<string, Path<DependentForm>> = {
  first_name: 'first_name', middle_name: 'middle_name', last_name: 'last_name', date_of_birth: 'date_of_birth',
  sex: 'sex', relationship: 'relationship', guardian_attestation: 'guardian_attestation', guardian_attestation_version: 'guardian_attestation',
};

export default function AddFamilyMember() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  // One key per "add" action: a retry after a lost response replays instead of adding twice.
  const idempotencyKey = useRef(newIdempotencyKey());
  const { control, handleSubmit, setError, formState } = useForm<DependentForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { first_name: '', middle_name: '', last_name: '', date_of_birth: '', sex: '', relationship: undefined as unknown as DependentForm['relationship'], guardian_attestation: false },
  });

  const add = useMutation({
    mutationFn: (values: DependentForm) => addDependent(values, idempotencyKey.current),
    onSuccess: () => {
      idempotencyKey.current = newIdempotencyKey();
      queryClient.invalidateQueries({ queryKey: ['dependents'] });
      if (router.canGoBack()) router.back();
      else router.replace('/family');
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, FIELD_MAP)),
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    add.mutate(values);
  });

  return (
    <Screen title="Add a family member" subtitle="Their details are private. Only you and the doctors you book with will see them.">
      {formError ? <Notice tone="error" message={formError} /> : null}
      <DependentFormFields control={control} errors={formState.errors} withAttestation />
      <Button label="Add family member" onPress={submit} loading={add.isPending} />
    </Screen>
  );
}
