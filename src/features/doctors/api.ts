/**
 * Doctor onboarding for the signed-in user (D-16: the patient profile stays).
 * POST /doctors, GET and PATCH /doctors/me, and the public GET /specialties.
 */
import { unwrap, type components } from '@mediconnect/api-client';
import { api, prepareWrites } from '@/lib/api';

export type MyDoctorProfile = components['schemas']['MyDoctorProfileResource'];
export type DoctorUpdate = components['schemas']['UpdateMyDoctorProfileRequest'];
export type PublicSpecialty = { id: string; name: string; slug: string; synonyms: string[] };

export async function startDoctorOnboarding(displayName: string, title: string | null): Promise<MyDoctorProfile> {
  await prepareWrites();
  return unwrap(await api.POST('/doctors', { body: { display_name: displayName.trim(), professional_title: title, confirm_licensed: true } }));
}

export async function fetchMyDoctorProfile(): Promise<MyDoctorProfile> {
  return unwrap(await api.GET('/doctors/me'));
}

export async function updateMyDoctorProfile(body: DoctorUpdate): Promise<MyDoctorProfile> {
  await prepareWrites();
  return unwrap(await api.PATCH('/doctors/me', { body }));
}

export async function fetchSpecialties(): Promise<PublicSpecialty[]> {
  return unwrap(await api.GET('/specialties')) as PublicSpecialty[];
}

/** The onboarding steps as the doctor sees them (CLAUDE.md §5.2). */
export const ONBOARDING_STEPS = [
  { status: 'REGISTERED', label: 'Profile started' },
  { status: 'DOCUMENTS_SUBMITTED', label: 'Credentials submitted' },
  { status: 'UNDER_REVIEW', label: 'Under review' },
  { status: 'VERIFIED', label: 'Verified' },
  { status: 'ACTIVE', label: 'Accepting patients' },
] as const;

export function nextStepText(status: MyDoctorProfile['onboarding_status']): string {
  switch (status) {
    case 'REGISTERED':
      return 'Complete your profile and add your PRC licence number. Uploading your PRC ID and other credentials comes next.';
    case 'DOCUMENTS_SUBMITTED':
      return 'Your credentials are in. Submit them for review when your profile is complete.';
    case 'UNDER_REVIEW':
      return 'A MediConnect medical administrator is checking your licence and credentials. You will be notified of the result.';
    case 'REJECTED':
      return 'Your verification needs changes. Fix what the reason above says, update your documents and submit again.';
    case 'VERIFIED':
      return 'You are verified. Your profile goes live once your clinics, services and fees are set up.';
    case 'ACTIVE':
      return 'Your profile is live and patients can find you.';
  }
}
