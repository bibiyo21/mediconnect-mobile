import { toForm, toUpdate } from '../mapping';
import type { MyDoctorProfile } from '../api';

const profile: MyDoctorProfile = {
  id: 'd1', display_name: 'Dr. Ana Santos', professional_title: 'MD', biography: null, prc_license_number_masked: '•••456',
  license_verification_status: 'NOT_VERIFIED', onboarding_status: 'REGISTERED', licence_locked: false, medical_school: null, years_experience: 12, gender: null,
  languages: ['en'],
  specialties: [
    { specialty_id: 'card', specialty_name: 'Cardiology', subspecialty_id: 'interv', subspecialty_name: 'Interventional Cardiology', is_primary: true, board_certified: true },
    { specialty_id: 'im', specialty_name: 'Internal Medicine', subspecialty_id: null, subspecialty_name: null, is_primary: false, board_certified: false },
  ],
  education: [], experience: [], profile_completeness: 40, verification_history: [],
};

describe('doctor profile mapping', () => {
  it('never pre-fills the licence number and sends it only when typed', () => {
    const form = toForm(profile);
    expect(form.prc_license_number).toBe('');
    expect(toUpdate(form, profile)).not.toHaveProperty('prc_license_number');
    expect(toUpdate({ ...form, prc_license_number: '0123456' }, profile)).toMatchObject({ prc_license_number: '0123456' });
  });

  it('keeps the other specialties and the subspecialty of the main one', () => {
    expect(toUpdate(toForm(profile), profile).specialties).toEqual([
      { specialty_id: 'card', subspecialty_id: 'interv', is_primary: true, board_certified: true },
      { specialty_id: 'im', subspecialty_id: null, is_primary: false, board_certified: false },
    ]);
  });

  it('makes a secondary specialty the main one without duplicating it', () => {
    const update = toUpdate({ ...toForm(profile), primary_specialty_id: 'im' }, profile);
    expect(update.specialties).toEqual([
      { specialty_id: 'im', subspecialty_id: null, is_primary: true, board_certified: false },
      { specialty_id: 'card', subspecialty_id: 'interv', is_primary: false, board_certified: true },
    ]);
  });

  it('sends empty optional fields as null and years as a number', () => {
    expect(toUpdate({ ...toForm(profile), years_experience: '', professional_title: '' }, profile)).toMatchObject({ years_experience: null, professional_title: null });
    expect(toUpdate(toForm(profile), profile)).toMatchObject({ years_experience: 12 });
  });
});
