import { ApiError } from '@mediconnect/api-client';

/** A message that is safe and useful to show; never raw server internals. */
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'RATE_LIMITED':
        return 'Too many attempts. Please wait a minute and try again.';
      case 'DEPENDENCY_UNAVAILABLE':
      case 'SERVER_ERROR':
        return 'Something went wrong on our side. Please try again.';
      default:
        return error.message;
    }
  }
  return 'We could not reach MediConnect. Check your connection and try again.';
}

/** Field errors from a 422, keyed by field name. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0] ?? '']));
}
