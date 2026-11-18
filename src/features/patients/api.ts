/**
 * The signed-in patient's own profile: GET and PATCH /patients/me
 * (backend contract; api-specification.md §2.2).
 */
import { unwrap, type components } from '@mediconnect/api-client';
import { api, prepareWrites } from '@/lib/api';
import { normalizeMobile, type ProfileForm } from '@/lib/validation';

export type MyPatientProfile = components['schemas']['MyPatientProfileResource'];
type ProfileUpdate = components['schemas']['UpdateMyPatientProfileRequest'];

export async function fetchMyProfile(): Promise<MyPatientProfile> {
  return unwrap(await api.GET('/patients/me'));
}

export async function updateMyProfile(form: ProfileForm): Promise<MyPatientProfile> {
  await prepareWrites();
  return unwrap(await api.PATCH('/patients/me', { body: toUpdate(form) }));
}

/** Form values → request body. Empty optional groups become null (removes them). */
export function toUpdate(form: ProfileForm): ProfileUpdate {
  const hasAddress = Boolean(form.line1 || form.city);
  return {
    first_name: form.first_name,
    middle_name: form.middle_name || null,
    last_name: form.last_name,
    date_of_birth: form.date_of_birth,
    sex: form.sex || null,
    preferred_language: form.preferred_language,
    emergency_contact: form.emergency_name && form.emergency_phone ? { name: form.emergency_name, phone: normalizeMobile(form.emergency_phone) } : null,
    address: hasAddress
      ? {
          line1: form.line1,
          line2: form.line2 || null,
          barangay: form.barangay || null,
          city: form.city,
          province: form.province || null,
          postal_code: form.postal_code || null,
        }
      : null,
  };
}

/** Profile → form values (nulls become empty strings). */
export function toForm(profile: MyPatientProfile): ProfileForm {
  return {
    first_name: profile.first_name,
    middle_name: profile.middle_name ?? '',
    last_name: profile.last_name,
    date_of_birth: profile.date_of_birth ?? '',
    sex: profile.sex ?? '',
    preferred_language: profile.preferred_language,
    emergency_name: profile.emergency_contact?.name ?? '',
    emergency_phone: profile.emergency_contact?.phone ?? '',
    line1: profile.address?.line1 ?? '',
    line2: profile.address?.line2 ?? '',
    barangay: profile.address?.barangay ?? '',
    city: profile.address?.city ?? '',
    province: profile.address?.province ?? '',
    postal_code: profile.address?.postal_code ?? '',
  };
}
