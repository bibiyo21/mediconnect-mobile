/**
 * Doctor presence for the signed-in doctor (increment 5.9). Every call is the server's answer;
 * the app holds no schedule or transition rules of its own.
 */
import { ApiError, type ApiErrorBody, type components } from '@mediconnect/api-client';
import { api, prepareWrites } from '@/lib/api';

export type PresenceState = components['schemas']['PresenceStateResource'];
export type DoctorDay = components['schemas']['DoctorDayResource'];
export type CheckOutPreview = components['schemas']['CheckOutPreviewResource'];
export type CheckOutResult = components['schemas']['CheckOutResultResource'];
export type CheckOutReason = components['schemas']['CheckOutReason'];
export type CheckOutDisposition = components['schemas']['CheckOutDisposition'];
export type DayLocation = DoctorDay['locations'][number];

type PresenceErrorBody = Partial<ApiErrorBody> & { reason_code?: string | null };

/** An ApiError that also keeps the server's `reason_code` (a fixed code, never free text). */
export class PresenceError extends ApiError {
  readonly reasonCode: string | null;

  constructor(status: number, body: PresenceErrorBody | undefined) {
    super(status, body);
    this.name = 'PresenceError';
    this.reasonCode = body?.reason_code ?? null;
  }
}

type Result = { data?: unknown; error?: unknown; response: Response };

/** Like unwrap(), but keeps reason_code on the thrown error. */
function take<T>(result: Result): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new PresenceError(result.response.status, result.error as PresenceErrorBody | undefined);
  }
  return (result.data as { data: T }).data;
}

export async function fetchPresence(): Promise<PresenceState> {
  return take<PresenceState>(await api.GET('/presence/me'));
}

export async function fetchDay(): Promise<DoctorDay> {
  return take<DoctorDay>(await api.GET('/presence/me/day'));
}

export async function fetchCheckOutPreview(clinicLocationId: string): Promise<CheckOutPreview> {
  return take<CheckOutPreview>(await api.GET('/presence/check-out/preview', { params: { query: { clinic_location_id: clinicLocationId } } }));
}

export async function checkIn(clinicLocationId: string): Promise<PresenceState> {
  await prepareWrites();
  return take<PresenceState>(await api.POST('/presence/check-in', { body: { clinic_location_id: clinicLocationId } }));
}

export async function startBreak(expectedMinutes: number, scheduledBreakId: string | null): Promise<PresenceState> {
  await prepareWrites();
  return take<PresenceState>(await api.POST('/presence/break/start', { body: { expected_minutes: expectedMinutes, scheduled_break_id: scheduledBreakId } }));
}

export async function endBreak(): Promise<PresenceState> {
  await prepareWrites();
  return take<PresenceState>(await api.POST('/presence/break/end'));
}

export async function markUnavailable(): Promise<PresenceState> {
  await prepareWrites();
  return take<PresenceState>(await api.POST('/presence/unavailable', { body: {} }));
}

export async function markAvailable(): Promise<PresenceState> {
  await prepareWrites();
  return take<PresenceState>(await api.POST('/presence/available'));
}

export type CheckOutBody = components['schemas']['CheckOutRequest'];

/** No Idempotency-Key: a repeat is refused with 409 not_checked_in (api-specification §2.7). */
export async function checkOut(body: CheckOutBody): Promise<CheckOutResult> {
  await prepareWrites();
  return take<CheckOutResult>(await api.POST('/presence/check-out', { body }));
}

