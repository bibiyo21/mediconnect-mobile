/**
 * Pure helpers for the scheduling screens: day names, Manila times, local
 * validation that mirrors the server's rules, and slot counts for a preview.
 * The server stays the authority on every rule.
 */
import type { ExceptionType, ShiftInput } from './api';

export const DAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 7, short: 'Sun', long: 'Sunday' },
] as const;

export const BOOKING_MODES = [
  { value: 'APPOINTMENT', label: 'Appointments' },
  { value: 'WALK_IN', label: 'Walk-ins' },
  { value: 'BOTH', label: 'Both' },
] as const;

/** Exception types a doctor records themselves (closures and holidays come from the clinic). */
export const TIME_OFF_TYPES: readonly { value: ExceptionType; label: string }[] = [
  { value: 'VACATION', label: 'Vacation' },
  { value: 'SICK_LEAVE', label: 'Sick leave' },
  { value: 'EMERGENCY_LEAVE', label: 'Emergency leave' },
  { value: 'TEMPORARY_UNAVAILABILITY', label: 'Unavailable for a while' },
  { value: 'SPECIAL_HOURS', label: 'Extra hours' },
];

const TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(TIME_OFF_TYPES.map((t) => [t.value, t.label])),
  CLINIC_CLOSURE: 'Clinic closed',
  PUBLIC_HOLIDAY: 'Public holiday',
  DOCTOR_REQUESTED_CHANGE: 'Schedule change',
  CLINIC_REQUESTED_CHANGE: 'Clinic schedule change',
};

export function exceptionLabel(type: string): string {
  return TYPE_LABELS[type] ?? 'Schedule change';
}

export function dayName(day: number, form: 'short' | 'long' = 'long'): string {
  return DAYS.find((d) => d.value === day)?.[form] ?? '';
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isTime(value: string): boolean {
  return TIME.test(value);
}

export function isDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** "09:00" to "9:00 AM", as Filipino patients usually read times. */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** An ISO instant as Manila wall time, "9:00 AM". */
export function formatManilaTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const manila = new Date(d.getTime() + 8 * 3600 * 1000);
  return formatTime(`${String(manila.getUTCHours()).padStart(2, '0')}:${String(manila.getUTCMinutes()).padStart(2, '0')}`);
}

/** A Manila date and time to the ISO form the API takes, "2026-12-24T09:00:00+08:00". */
export function manilaInstant(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

/**
 * How many appointment slots a shift makes, before breaks, clinic hours and
 * exceptions. A rough guide for the editor, not availability.
 */
export function slotEstimate(shift: Pick<ShiftInput, 'starts_at' | 'ends_at' | 'slot_duration_minutes' | 'buffer_minutes' | 'max_appointments' | 'breaks'>): number {
  if (!isTime(shift.starts_at) || !isTime(shift.ends_at) || shift.slot_duration_minutes < 5) return 0;
  let windows: [number, number][] = [[minutesOf(shift.starts_at), minutesOf(shift.ends_at)]];
  for (const b of shift.breaks) {
    if (!isTime(b.starts_at) || !isTime(b.ends_at)) continue;
    const [bs, be] = [minutesOf(b.starts_at), minutesOf(b.ends_at)];
    windows = windows.flatMap(([s, e]) => (be <= s || bs >= e ? [[s, e] as [number, number]] : [[s, Math.min(bs, e)], [Math.max(be, s), e]].filter(([a, z]) => z > a) as [number, number][]));
  }
  const step = shift.slot_duration_minutes + Math.max(0, shift.buffer_minutes);
  const count = windows.reduce((n, [s, e]) => n + Math.max(0, Math.floor((e - s + Math.max(0, shift.buffer_minutes)) / step)), 0);
  return shift.max_appointments ? Math.min(count, shift.max_appointments) : count;
}

/** Field errors for one shift, keyed like the server's (`shifts.0.ends_at`). */
export function shiftErrors(shift: ShiftInput, index: number): Record<string, string> {
  const key = (f: string) => `shifts.${index}.${f}`;
  const errors: Record<string, string> = {};
  if (!shift.doctor_service_mode_id) errors[key('doctor_service_mode_id')] = 'Choose the service for this shift.';
  if (!isTime(shift.starts_at)) errors[key('starts_at')] = 'Use a 24-hour time like 09:00.';
  if (!isTime(shift.ends_at)) errors[key('ends_at')] = 'Use a 24-hour time like 17:00.';
  else if (isTime(shift.starts_at) && minutesOf(shift.ends_at) <= minutesOf(shift.starts_at)) errors[key('ends_at')] = 'The shift must end after it starts.';
  if (!Number.isInteger(shift.slot_duration_minutes) || shift.slot_duration_minutes < 5 || shift.slot_duration_minutes > 480) errors[key('slot_duration_minutes')] = 'Use 5 to 480 minutes.';
  if (!Number.isInteger(shift.buffer_minutes) || shift.buffer_minutes < 0 || shift.buffer_minutes > 120) errors[key('buffer_minutes')] = 'Use 0 to 120 minutes.';
  if (shift.max_appointments !== null && (!Number.isInteger(shift.max_appointments) || shift.max_appointments < 1 || shift.max_appointments > 500)) errors[key('max_appointments')] = 'Use 1 to 500, or leave it empty for no limit.';
  shift.breaks.forEach((b, i) => {
    const bk = `shifts.${index}.breaks.${i}`;
    if (!isTime(b.starts_at) || !isTime(b.ends_at)) errors[`${bk}.starts_at`] = 'Use 24-hour times like 12:00 and 13:00.';
    else if (minutesOf(b.ends_at) <= minutesOf(b.starts_at)) errors[`${bk}.ends_at`] = 'The break must end after it starts.';
  });
  return errors;
}
