import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { fieldErrors, userMessage } from './errors';

/**
 * Puts server validation errors on the matching form fields; returns a
 * message for the form-level notice when no field claims the error.
 */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fieldMap: Record<string, Path<T>> = {}): string | null {
  const fields = fieldErrors(error);
  let placed = false;
  for (const [field, message] of Object.entries(fields)) {
    const target = fieldMap[field];
    if (target && message) {
      setError(target, { type: 'server', message });
      placed = true;
    }
  }
  return placed ? null : userMessage(error);
}
