/**
 * Doctor scheduling (Phase 4): how each service is booked, weekly schedules,
 * time off and special hours, and a preview of open times. Typed by the
 * backend contract; the server validates everything again.
 */
import { unwrap, type components } from '@mediconnect/api-client';
import { api, prepareWrites } from '@/lib/api';

export type ServiceMode = components['schemas']['ServiceModeResource'];
export type Schedule = components['schemas']['ScheduleResource'];
export type Shift = Schedule['shifts'][number];
export type ScheduleException = components['schemas']['ScheduleExceptionResource'];
export type BookingMode = 'APPOINTMENT' | 'WALK_IN' | 'BOTH';

export interface ShiftInput {
  day_of_week: number;
  doctor_service_mode_id: string;
  starts_at: string;
  ends_at: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  max_appointments: number | null;
  breaks: { starts_at: string; ends_at: string }[];
}

export interface ScheduleInput {
  name: string;
  effective_from: string;
  status: 'DRAFT' | 'ACTIVE';
  shifts: ShiftInput[];
}

export type ExceptionType = components['schemas']['CreateScheduleExceptionRequest']['exception_type'];

export interface ExceptionInput {
  exception_type: ExceptionType;
  clinic_location_id: string | null;
  doctor_service_mode_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

/** One advisory open time, typed by the backend contract (AvailabilitySlotResource). */
export type OpenTime = components['schemas']['AvailabilitySlotResource'];

export async function fetchServiceModes(): Promise<ServiceMode[]> {
  return unwrap(await api.GET('/doctors/me/service-modes'));
}

export async function setServiceMode(serviceId: string, mode: BookingMode): Promise<ServiceMode> {
  await prepareWrites();
  return unwrap(await api.PUT('/doctors/me/services/{serviceId}/mode', { params: { path: { serviceId } }, body: { service_mode: mode } }));
}

export async function fetchSchedules(): Promise<Schedule[]> {
  return unwrap(await api.GET('/schedules'));
}

export async function fetchSchedule(id: string): Promise<Schedule> {
  return unwrap(await api.GET('/schedules/{scheduleId}', { params: { path: { scheduleId: id } } }));
}

export async function createSchedule(body: ScheduleInput): Promise<Schedule> {
  await prepareWrites();
  return unwrap(await api.POST('/schedules', { body }));
}

/** Optimistic lock: the version last read goes in If-Match; a stale one answers 409 CONCURRENT_MODIFICATION. */
export async function updateSchedule(id: string, version: number, body: ScheduleInput): Promise<Schedule> {
  await prepareWrites();
  return unwrap(await api.PATCH('/schedules/{scheduleId}', { params: { path: { scheduleId: id } }, headers: { 'If-Match': String(version) }, body }));
}

/** Archives the schedule; appointments already booked are kept and flagged for rescheduling, never cancelled. */
export async function archiveSchedule(id: string, version: number): Promise<{ affected_appointments: string[] }> {
  await prepareWrites();
  return unwrap(await api.DELETE('/schedules/{scheduleId}', { params: { path: { scheduleId: id } }, headers: { 'If-Match': String(version) } })) as { affected_appointments: string[] };
}

export async function fetchExceptions(): Promise<ScheduleException[]> {
  return unwrap(await api.GET('/schedule-exceptions'));
}

export async function createException(body: ExceptionInput): Promise<ScheduleException & { affected_appointments: string[] }> {
  await prepareWrites();
  return unwrap(await api.POST('/schedule-exceptions', { body })) as ScheduleException & { affected_appointments: string[] };
}

export async function cancelException(id: string): Promise<void> {
  await prepareWrites();
  unwrap(await api.DELETE('/schedule-exceptions/{exceptionId}', { params: { path: { exceptionId: id } } }));
}

/** The public, advisory open times patients see (only once the doctor is ACTIVE). */
export async function fetchOpenTimes(doctorId: string, from: string, to: string): Promise<OpenTime[]> {
  return unwrap(await api.GET('/doctors/{doctorId}/availability', { params: { path: { doctorId }, query: { from, to } } }));
}
