import { dayName, exceptionLabel, formatManilaTime, formatTime, isDate, isTime, manilaInstant, shiftErrors, slotEstimate } from '../format';

const shift = { day_of_week: 1, doctor_service_mode_id: 'm1', starts_at: '09:00', ends_at: '12:00', slot_duration_minutes: 20, buffer_minutes: 5, max_appointments: null, breaks: [] as { starts_at: string; ends_at: string }[] };

describe('scheduling format helpers', () => {
  it('names days and exception types', () => {
    expect(dayName(1)).toBe('Monday');
    expect(dayName(7, 'short')).toBe('Sun');
    expect(exceptionLabel('SICK_LEAVE')).toBe('Sick leave');
    expect(exceptionLabel('CLINIC_CLOSURE')).toBe('Clinic closed');
    expect(exceptionLabel('SOMETHING_NEW')).toBe('Schedule change');
  });

  it('checks and formats times and dates', () => {
    expect(isTime('09:00')).toBe(true);
    expect(isTime('9:00')).toBe(false);
    expect(isTime('24:00')).toBe(false);
    expect(isDate('2026-12-24')).toBe(true);
    expect(isDate('2026-02-30')).toBe(false);
    expect(formatTime('00:30')).toBe('12:30 AM');
    expect(formatTime('13:05')).toBe('1:05 PM');
    expect(formatManilaTime('2026-11-30T01:00:00Z')).toBe('9:00 AM');
    expect(manilaInstant('2026-12-24', '09:00')).toBe('2026-12-24T09:00:00+08:00');
  });

  it('estimates slots like the server generator: buffers between slots, breaks cut the window, the cap applies', () => {
    // 09:00, 09:25, 09:50, 10:15, 10:40, 11:05, 11:30 (ends 11:50).
    expect(slotEstimate(shift)).toBe(7);
    expect(slotEstimate({ ...shift, breaks: [{ starts_at: '10:30', ends_at: '11:00' }] })).toBe(5);
    expect(slotEstimate({ ...shift, max_appointments: 4 })).toBe(4);
    expect(slotEstimate({ ...shift, ends_at: 'later' })).toBe(0);
  });

  it('reports shift errors under the server field names', () => {
    expect(shiftErrors(shift, 0)).toEqual({});
    const errors = shiftErrors({ ...shift, doctor_service_mode_id: '', ends_at: '08:00', buffer_minutes: 200, max_appointments: 0, breaks: [{ starts_at: '11:00', ends_at: '10:00' }] }, 2);
    expect(Object.keys(errors).sort()).toEqual(['shifts.2.breaks.0.ends_at', 'shifts.2.buffer_minutes', 'shifts.2.doctor_service_mode_id', 'shifts.2.ends_at', 'shifts.2.max_appointments']);
  });
});
