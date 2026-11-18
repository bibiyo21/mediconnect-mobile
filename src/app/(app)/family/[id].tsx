import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { Button, Card, Notice, Screen, StateView } from '@/components/ui';
import { dependentToForm, fetchDependent, removeDependent, updateDependent } from '@/features/patients/api';
import { DependentFormFields } from '@/features/patients/DependentFormFields';
import { userMessage } from '@/lib/errors';
import { applyServerErrors } from '@/lib/forms';
import { dependentSchema, type DependentForm } from '@/lib/validation';

const FIELD_MAP: Record<string, Path<DependentForm>> = {
  first_name: 'first_name', middle_name: 'middle_name', last_name: 'last_name', date_of_birth: 'date_of_birth', sex: 'sex', relationship: 'relationship',
};

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/family');
}

export default function EditFamilyMember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const dependent = useQuery({ queryKey: ['dependents', id], queryFn: () => fetchDependent(id), enabled: Boolean(id) });
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const { control, handleSubmit, setError, reset, formState } = useForm<DependentForm>({ resolver: zodResolver(dependentSchema) });

  useEffect(() => {
    if (dependent.data) reset(dependentToForm(dependent.data));
  }, [dependent.data, reset]);

  const save = useMutation({
    mutationFn: (values: DependentForm) => updateDependent(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependents'] });
      leave();
    },
    onError: (error) => setFormError(applyServerErrors(error, setError, FIELD_MAP)),
  });

  const remove = useMutation({
    mutationFn: () => removeDependent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dependents'] });
      leave();
    },
    onError: (error) => setFormError(userMessage(error)),
  });

  if (dependent.isPending) {
    return (
      <Screen title="Family member">
        <StateView state="loading" message="Loading" />
      </Screen>
    );
  }
  if (dependent.isError) {
    return (
      <Screen title="Family member">
        <StateView state="error" message={userMessage(dependent.error)} onRetry={() => dependent.refetch()} />
      </Screen>
    );
  }

  const submit = handleSubmit((values) => {
    setFormError(null);
    save.mutate(values);
  });

  return (
    <Screen title={`${dependent.data.first_name} ${dependent.data.last_name}`}>
      {formError ? <Notice tone="error" message={formError} /> : null}
      <DependentFormFields control={control} errors={formState.errors} withAttestation={false} />
      <Button label="Save changes" onPress={submit} loading={save.isPending} />
      <Card title="Remove from your account">
        {confirmingRemove ? (
          <>
            <Notice tone="warning" message={`You will no longer manage ${dependent.data.first_name}'s care in MediConnect. Their records are kept and are not deleted.`} />
            <Button label={`Yes, remove ${dependent.data.first_name}`} variant="danger" onPress={() => remove.mutate()} loading={remove.isPending} />
            <Button label="Keep" variant="secondary" onPress={() => setConfirmingRemove(false)} />
          </>
        ) : (
          <Button label="Remove family member" variant="danger" onPress={() => setConfirmingRemove(true)} />
        )}
      </Card>
    </Screen>
  );
}
