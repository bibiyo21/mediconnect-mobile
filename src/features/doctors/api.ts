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
      return 'Your application is in the review queue. A medical administrator will check your licence and documents.';
    case 'UNDER_REVIEW':
      return 'A MediConnect medical administrator is checking your licence and credentials. You will be notified of the result.';
    case 'REJECTED':
      return 'Your verification needs changes. Fix what the reason above says, update your documents and submit again.';
    case 'VERIFIED':
      return 'You are verified. Accept your clinic invitations and add your services and fees; a medical administrator then activates your profile.';
    case 'ACTIVE':
      return 'Your profile is live and patients can find you.';
  }
}

// Clinic assignments and services with fees (increment 2.10).
export type MyAssignment = components['schemas']['DoctorAssignmentResource'];
export type MyService = components['schemas']['DoctorServiceResource'];
export type NewService = components['schemas']['CreateDoctorServiceRequest'];

export async function fetchMyAssignments(): Promise<MyAssignment[]> {
  return unwrap(await api.GET('/doctors/me/assignments'));
}

export async function acceptAssignment(id: string): Promise<MyAssignment> {
  await prepareWrites();
  return unwrap(await api.POST('/doctors/me/assignments/{assignmentId}/accept', { params: { path: { assignmentId: id } } }));
}

/** Declines a pending invitation or ends an active assignment. */
export async function endAssignment(id: string, reason: string): Promise<MyAssignment> {
  await prepareWrites();
  return unwrap(await api.POST('/doctors/me/assignments/{assignmentId}/end', { params: { path: { assignmentId: id } }, body: { reason } }));
}

export async function fetchMyServices(): Promise<MyService[]> {
  return unwrap(await api.GET('/doctors/me/services'));
}

export async function addService(body: NewService): Promise<MyService> {
  await prepareWrites();
  return unwrap(await api.POST('/doctors/me/services', { body }));
}

/** A change ends the current row and starts a new one; the response is the new row. */
export async function changeServiceFee(id: string, feeAmount: number): Promise<MyService> {
  await prepareWrites();
  return unwrap(await api.PATCH('/doctors/me/services/{serviceId}', { params: { path: { serviceId: id } }, body: { fee_amount: feeAmount } }));
}

export async function removeService(id: string): Promise<void> {
  await prepareWrites();
  unwrap(await api.DELETE('/doctors/me/services/{serviceId}', { params: { path: { serviceId: id } } }));
}
