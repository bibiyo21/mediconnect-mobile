import { emptyFilters, formatNextOpen, suggestionLabel, toDoctorQuery, toSpecialtyFilter, type SpecialtySuggestion } from '../api';

jest.mock('@/lib/api', () => ({ api: {} }));

describe('toDoctorQuery', () => {
  it('leaves out blank filters and trims text', () => {
    expect(toDoctorQuery({ ...emptyFilters, q: '  pedia  ', city: ' ' })).toEqual({ q: 'pedia' });
  });

  it('sends specialty, subspecialty, city, consultation type and the cursor', () => {
    const query = toDoctorQuery({ q: '', city: 'Makati', mode: 'ONLINE', specialty: { specialtyId: 'sp1', subspecialtyId: 'sub1', name: 'x' } }, 'abc');
    expect(query).toEqual({ city: 'Makati', consultation_type: 'ONLINE', specialty: 'sp1', subspecialty: 'sub1', cursor: 'abc' });
  });

  it('caps the text at the 100 characters the API accepts', () => {
    expect(toDoctorQuery({ ...emptyFilters, q: 'a'.repeat(150) }).q).toHaveLength(100);
  });
});

describe('specialty suggestions', () => {
  const sub: SpecialtySuggestion = { specialty_id: 'card', id: 'ic', name: 'Interventional Cardiology', kind: 'SUBSPECIALTY', parent_name: 'Cardiology', doctor_count: 2 };

  it('maps a subspecialty to its parent specialty plus the subspecialty', () => {
    expect(toSpecialtyFilter(sub)).toEqual({ specialtyId: 'card', subspecialtyId: 'ic', name: 'Interventional Cardiology (Cardiology)' });
    expect(toSpecialtyFilter({ ...sub, id: 'card', kind: 'SPECIALTY', name: 'Cardiology', parent_name: null }).subspecialtyId).toBeNull();
    expect(suggestionLabel({ ...sub, kind: 'SPECIALTY', parent_name: null })).toBe('Interventional Cardiology');
  });
});

describe('availability filters (4.8)', () => {
  // 2026-11-22 23:30 in Manila is 15:30 UTC: "today" must follow Manila, not UTC.
  const now = new Date('2026-11-22T15:30:00Z');

  it('maps day, part of day and sort to the API parameters in Philippine time', () => {
    expect(toDoctorQuery({ ...emptyFilters, day: 'TODAY', time: 'MORNING' }, undefined, now)).toEqual({ available_date: '2026-11-22', available_time_from: '06:00', available_time_to: '12:00' });
    expect(toDoctorQuery({ ...emptyFilters, day: 'TOMORROW', sort: 'next_available' }, undefined, now)).toEqual({ available_date: '2026-11-23', sort: 'next_available' });
    expect(toDoctorQuery({ ...emptyFilters, time: 'EVENING' }, undefined, now)).toEqual({ available_time_from: '17:00', available_time_to: '22:00' });
    expect(toDoctorQuery(emptyFilters, undefined, now)).toEqual({});
  });

  it('formats the next open time in Manila and never invents one', () => {
    expect(formatNextOpen('2026-11-22T15:45:00Z', now)).toBe('Today, 11:45 PM');
    expect(formatNextOpen('2026-11-23T01:00:00Z', now)).toBe('Tomorrow, 9:00 AM');
    expect(formatNextOpen('2026-11-30T06:30:00Z', now)).toBe('Mon 30 Nov, 2:30 PM');
    expect(formatNextOpen(null, now)).toBeNull();
    expect(formatNextOpen('soon', now)).toBeNull();
  });
});
