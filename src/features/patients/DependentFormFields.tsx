import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Text } from 'react-native';
import { Checkbox, ChoiceGroup, TextField } from '@/components/ui';
import { birthDateAutoComplete } from '@/lib/device';
import { formatDateInput, type DependentForm } from '@/lib/validation';
import { typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export const RELATIONSHIP_OPTIONS = [
  { value: 'CHILD', label: 'Child' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'SPOUSE', label: 'Spouse or partner' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'GRANDPARENT', label: 'Grandparent' },
  { value: 'GRANDCHILD', label: 'Grandchild' },
  { value: 'LEGAL_WARD', label: 'Legal ward' },
  { value: 'OTHER', label: 'Other' },
] as const;

const SEX_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'OTHER', label: 'Other' },
] as const;

export function relationshipLabel(value: string): string {
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Shared fields of the add and edit screens. `withAttestation` shows the guardian confirmation (add only). */
export function DependentFormFields({ control, errors, withAttestation }: { control: Control<DependentForm>; errors: FieldErrors<DependentForm>; withAttestation: boolean }) {
  const { colors } = useTheme();
  const text = (name: 'first_name' | 'middle_name' | 'last_name' | 'date_of_birth', label: string, extra: object = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          label={label}
          value={field.value ?? ''}
          onChangeText={name === 'date_of_birth' ? (v) => field.onChange(formatDateInput(v)) : field.onChange}
          onBlur={field.onBlur}
          error={errors[name]?.message}
          {...extra}
        />
      )}
    />
  );

  return (
    <>
      {text('first_name', 'First name')}
      {text('middle_name', 'Middle name (optional)')}
      {text('last_name', 'Last name')}
      {text('date_of_birth', 'Date of birth', { hint: 'Year, month, day. For example 2018-05-17.', placeholder: 'YYYY-MM-DD', keyboardType: 'number-pad', maxLength: 10, autoComplete: birthDateAutoComplete })}
      <Controller
        control={control}
        name="relationship"
        render={({ field }) => <ChoiceGroup label="Relationship to you" options={RELATIONSHIP_OPTIONS} value={field.value} onChange={field.onChange} error={errors.relationship?.message} />}
      />
      <Controller
        control={control}
        name="sex"
        render={({ field }) => <ChoiceGroup label="Sex (optional)" options={SEX_OPTIONS} value={field.value} onChange={field.onChange} error={errors.sex?.message} />}
      />
      {withAttestation ? (
        <Controller
          control={control}
          name="guardian_attestation"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onChange={field.onChange}
              accessibilityLabel="I confirm I am authorised to manage this person's health information"
              error={errors.guardian_attestation?.message}
              label={
                <Text style={{ ...typography.body, color: colors.textPrimary }}>
                  I am this person&apos;s parent, legal guardian, or otherwise authorised to manage their health information and to share it with their doctors.
                </Text>
              }
            />
          )}
        />
      ) : null}
    </>
  );
}
