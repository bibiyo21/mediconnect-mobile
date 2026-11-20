import { emptyFilters, suggestionLabel, toDoctorQuery, toSpecialtyFilter, type SpecialtySuggestion } from '../api';

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
