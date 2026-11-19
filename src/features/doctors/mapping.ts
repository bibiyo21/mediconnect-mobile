import type { DoctorProfileForm } from '@/lib/validation';
import type { DoctorUpdate, MyDoctorProfile } from './api';

/** Profile -> edit form. The licence field starts empty: the saved number is never sent back to the app. */
export function toForm(p: MyDoctorProfile): DoctorProfileForm {
  return {
    display_name: p.display_name,
    professional_title: p.professional_title ?? '',
    biography: p.biography ?? '',
    prc_license_number: '',
    medical_school: p.medical_school ?? '',
    years_experience: p.years_experience === null ? '' : String(p.years_experience),
    gender: (p.gender ?? '') as DoctorProfileForm['gender'],
    languages: p.languages,
    primary_specialty_id: p.specialties.find((s) => s.is_primary)?.specialty_id ?? '',
  };
}

/** Form -> PATCH body. Keeps the doctor's other specialties; only the main one is chosen in the app. */
export function toUpdate(form: DoctorProfileForm, current: MyDoctorProfile): DoctorUpdate {
  const others = current.specialties
    .filter((s) => s.specialty_id !== form.primary_specialty_id)
    .map((s) => ({ specialty_id: s.specialty_id, subspecialty_id: s.subspecialty_id, is_primary: false, board_certified: s.board_certified }));
  const previousPrimary = current.specialties.find((s) => s.specialty_id === form.primary_specialty_id);
  return {
    display_name: form.display_name,
    professional_title: form.professional_title || null,
    biography: form.biography || null,
    ...(form.prc_license_number ? { prc_license_number: form.prc_license_number } : {}),
    medical_school: form.medical_school || null,
    years_experience: form.years_experience === '' ? null : Number(form.years_experience),
    gender: (form.gender || null) as DoctorUpdate['gender'],
    languages: form.languages,
    specialties: [{ specialty_id: form.primary_specialty_id, subspecialty_id: previousPrimary?.subspecialty_id ?? null, is_primary: true, board_certified: previousPrimary?.board_certified ?? false }, ...others],
  };
}

