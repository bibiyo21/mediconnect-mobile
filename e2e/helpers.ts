import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.2 AA scan; returns readable violation ids. */
export async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const account = {
  id: '01a1ec01-0000-7000-8000-000000000001',
  email: 'patient@example.test',
  mobile_masked: null,
  email_verified: true,
  mobile_verified: false,
  status: 'ACTIVE',
  locale: 'en',
  roles: ['PATIENT'],
  profile: { first_name: 'Ana', middle_name: null, last_name: 'Reyes' },
};

export const patientProfile = {
  id: '01a1ec01-0000-7000-8000-0000000000p1',
  first_name: 'Ana',
  middle_name: null,
  last_name: 'Reyes',
  date_of_birth: '1990-05-17',
  sex: null,
  preferred_language: 'en',
  emergency_contact: null,
  address: null,
};

const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, meta: {}, message: null }) });

/**
 * The web build uses cookie sessions: the app asks GET /auth/me at start-up.
 * These mocks stand in for the backend so the suite runs without it.
 */
export async function mockApi(page: Page, { signedIn, doctor = null }: { signedIn: boolean; doctor?: 'REGISTERED' | 'REJECTED' | 'VERIFIED' | null }): Promise<void> {
  const me = doctor ? { ...account, roles: ['PATIENT', 'DOCTOR'] } : account;
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/auth/me', (route) =>
    signedIn ? route.fulfill(ok(me)) : route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Unauthenticated.', errors: {}, code: 'UNAUTHENTICATED' }) }),
  );
  await page.route('**/api/v1/auth/devices', (route) =>
    route.fulfill(ok([{ id: 'd1', platform: 'WEB', device_name: null, app_version: null, last_seen_at: '2026-11-18T00:15:00Z', created_at: '2026-11-18T00:14:00Z', current: true }])),
  );
  await page.route('**/api/v1/patients/me', (route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill(ok({ ...patientProfile, ...(route.request().postDataJSON() as object) }));
    }
    return route.fulfill(ok(patientProfile));
  });
  const dependents = [{ id: '01a1ec01-0000-7000-8000-0000000000d1', first_name: 'Lia', middle_name: null, last_name: 'Reyes', date_of_birth: '2018-03-10', sex: 'FEMALE', relationship: 'CHILD', authorized_at: '2026-11-18T00:00:00Z' }];
  await page.route('**/api/v1/patients/me/dependents', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...body, id: '01a1ec01-0000-7000-8000-0000000000d2', authorized_at: '2026-11-18T01:00:00Z' }, meta: {}, message: null }) });
    }
    return route.fulfill(ok(dependents));
  });
  await page.route('**/api/v1/patients/me/dependents/*', (route) => {
    const method = route.request().method();
    if (method === 'DELETE') return route.fulfill(ok({}));
    if (method === 'PATCH') return route.fulfill(ok({ ...dependents[0], ...(route.request().postDataJSON() as object) }));
    return route.fulfill(ok(dependents[0]));
  });
  await page.route('**/api/v1/auth/account/deletion-request', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ success: true, data: { deletion_scheduled_for: '2026-12-18T03:00:00Z' }, meta: {}, message: 'Your account is scheduled for deletion. Sign in before then to keep it.' }) }),
  );
  await page.route('**/api/v1/auth/contact/otp', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ success: true, data: { challenge_id: '01a1ec01-0000-7000-8000-0000000000c2', channel: 'SMS', destination_masked: '+63•••••••4567', expires_at: '2026-11-18T00:30:00Z' }, meta: {}, message: 'If the address can receive a code, one has been sent.' }) }),
  );
  await page.route('**/api/v1/auth/contact', (route) => route.fulfill(ok({ ...account, mobile_masked: '+63•••••••4567', mobile_verified: true })));
  const specialties = [
    { id: 'sp-card', name: 'Cardiology', slug: 'cardiology', synonyms: ['cardiologist'], subspecialties: [] },
    { id: 'sp-im', name: 'Internal Medicine', slug: 'internal-medicine', synonyms: ['internist'], subspecialties: [] },
    { id: 'sp-ped', name: 'Pediatrics', slug: 'pediatrics', synonyms: ['pedia'], subspecialties: [] },
  ];
  await page.route('**/api/v1/specialties', (route) => route.fulfill(ok(specialties)));
  let doctorProfile = {
    id: 'doc1', display_name: 'Dr. Ana Reyes', professional_title: 'MD' as string | null, biography: null, prc_license_number_masked: null,
    license_verification_status: doctor === 'REJECTED' ? 'REJECTED' : doctor === 'VERIFIED' ? 'VERIFIED' : 'NOT_VERIFIED', onboarding_status: doctor ?? 'REGISTERED', licence_locked: false,
    medical_school: null, years_experience: null, gender: null, languages: ['en'],
    specialties: [{ specialty_id: 'sp-im', specialty_name: 'Internal Medicine', subspecialty_id: null, subspecialty_name: null, is_primary: true, board_certified: false, verification_status: 'SELF_REPORTED' }],
    specialty_review_pending: false,
    education: [], experience: [], profile_completeness: 35,
    verification_history: doctor === 'REJECTED'
      ? [{ from_status: null, to_status: 'REGISTERED', reason: null, occurred_at: '2026-11-18T01:00:00Z' }, { from_status: 'UNDER_REVIEW', to_status: 'REJECTED', reason: 'The PRC ID photo is unreadable.', occurred_at: '2026-11-19T01:00:00Z' }]
      : [{ from_status: null, to_status: 'REGISTERED', reason: null, occurred_at: '2026-11-18T01:00:00Z' }],
  };
  // Public directory (2.11); test fixtures only.
  const publicDoctor = {
    id: '01a1ed01-0000-7000-8000-00000000d001', display_name: 'Dr. Ana Reyes', professional_title: 'MD', licence_verified: true, primary_specialty: 'Pediatrics',
    specialties: [{ specialty_id: 'sp-ped', name: 'Pediatrics', subspecialty: null, board_certified: true }], languages: ['en', 'fil'], years_experience: 8,
    practice_locations: [{ clinic_id: '01a1ec01-0000-7000-8000-00000000c001', clinic_name: 'Santos Family Clinic', clinic_location_id: 'loc1', location_name: 'Makati branch', city: 'Makati' }],
    biography: 'Pediatrician caring for children in Makati.', medical_school: null, gender: null, education: [],
  };
  const publicClinic = {
    id: '01a1ec01-0000-7000-8000-00000000c001', name: 'Santos Family Clinic', slug: 'santos-family-clinic', description: 'Family care in Makati.', organization_name: 'Santos Medical Group',
    locations: [{ id: 'loc1', name: 'Makati branch', address_line1: 'Mabini St', address_line2: null, barangay: 'Poblacion', city: 'Makati', province: null, postal_code: null, latitude: null, longitude: null, timezone: 'Asia/Manila', phone: null, hospital_name: null,
      operating_hours: [{ day_of_week: 1, opens_at: '08:00', closes_at: '12:00' }], services: [] }],
    upcoming_closures: [],
  };
  await page.route(/\/api\/v1\/doctors\?.*$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [publicDoctor], meta: { page: 1, per_page: 20, total: 1, last_page: 1 }, message: null }) }));
  await page.route(/\/api\/v1\/doctors\/01a1ed01-0000-7000-8000-00000000d001$/, (route) => route.fulfill(ok(publicDoctor)));
  await page.route(/\/api\/v1\/doctors\/01a1ed01-0000-7000-8000-00000000d001\/services$/, (route) => route.fulfill(ok([
    { id: 'ps1', name: 'Consultation', consultation_type: 'IN_PERSON', clinic_location_id: 'loc1', location_name: 'Makati branch', clinic_service_id: null, is_follow_up: false, duration_minutes: 20, buffer_minutes: 5, fee: { amount: 65000, currency: 'PHP', formatted: '₱650.00' }, is_hmo_eligible: false, status: 'ACTIVE', effective_from: '2026-11-19T02:00:00Z', effective_until: null },
  ])));
  await page.route(/\/api\/v1\/clinics\/01a1ec01-0000-7000-8000-00000000c001$/, (route) => route.fulfill(ok(publicClinic)));
  await page.route(/\/api\/v1\/clinics\/01a1ec01-0000-7000-8000-00000000c001\/doctors$/, (route) => route.fulfill(ok([{ id: publicDoctor.id, display_name: 'Dr. Ana Reyes', professional_title: 'MD', primary_specialty: 'Pediatrics', location_ids: ['loc1'] }])));
  await page.route('**/api/v1/doctors', (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [publicDoctor], meta: { page: 1, per_page: 20, total: 1, last_page: 1 }, message: null }) });
    const body = route.request().postDataJSON() as { display_name: string; professional_title: string | null };
    doctorProfile = { ...doctorProfile, display_name: body.display_name, professional_title: body.professional_title };
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: doctorProfile, meta: {}, message: null }) });
  });
  await page.route('**/api/v1/doctors/me', (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      doctorProfile = { ...doctorProfile, ...(body as object), prc_license_number_masked: body.prc_license_number ? `•••${String(body.prc_license_number).slice(-3)}` : doctorProfile.prc_license_number_masked } as typeof doctorProfile;
      return route.fulfill(ok(doctorProfile));
    }
    return doctor ? route.fulfill(ok(doctorProfile)) : route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Not found.', errors: {}, code: 'NOT_FOUND' }) });
  });
  // Clinic assignments and services (2.10); test fixtures only.
  const location = { clinic_id: 'c1', clinic_name: 'Santos Family Clinic', clinic_location_id: 'loc1', location_name: 'Makati branch', location_city: 'Makati' };
  let assignments = [
    { id: 'as1', status: 'ACTIVE', doctor_profile_id: 'doc1', doctor_display_name: 'Dr. Ana Reyes', ...location, effective_from: '2026-11-19T02:00:00Z' as string | null, effective_until: null, end_reason: null, requested_at: '2026-11-18T02:00:00Z' },
    { id: 'as2', status: 'PENDING', doctor_profile_id: 'doc1', doctor_display_name: 'Dr. Ana Reyes', clinic_id: 'c2', clinic_name: 'Reyes Medical Center', clinic_location_id: 'loc2', location_name: 'Quezon City', location_city: 'Quezon City', effective_from: null as string | null, effective_until: null, end_reason: null, requested_at: '2026-11-20T02:00:00Z' },
  ];
  const peso = (amount: number) => ({ amount, currency: 'PHP', formatted: `₱${(amount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` });
  let services = [
    { id: 'sv1', name: 'Consultation', consultation_type: 'IN_PERSON', clinic_location_id: 'loc1' as string | null, location_name: 'Makati branch' as string | null, clinic_service_id: null, is_follow_up: false, duration_minutes: 20, buffer_minutes: 5, fee: peso(65000), is_hmo_eligible: false, status: 'ACTIVE', effective_from: '2026-11-19T02:00:00Z', effective_until: null },
  ];
  await page.route('**/api/v1/doctors/me/assignments', (route) => route.fulfill(ok(assignments)));
  await page.route(/\/api\/v1\/doctors\/me\/assignments\/[^/]+\/accept$/, (route) => {
    const id = route.request().url().split('/').at(-2);
    assignments = assignments.map((a) => (a.id === id ? { ...a, status: 'ACTIVE', effective_from: '2026-11-20T03:00:00Z' } : a));
    return route.fulfill(ok(assignments.find((a) => a.id === id)));
  });
  await page.route('**/api/v1/doctors/me/services', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { name: string; consultation_type: string; clinic_location_id: string | null; duration_minutes: number; fee_amount: number };
      const created = { ...services[0], id: `sv${services.length + 1}`, name: body.name, consultation_type: body.consultation_type, clinic_location_id: body.clinic_location_id, location_name: null, duration_minutes: body.duration_minutes, fee: peso(body.fee_amount) };
      services = [...services, created];
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: created, meta: {}, message: null }) });
    }
    return route.fulfill(ok(services));
  });
  await page.route(/\/api\/v1\/doctors\/me\/services\/[^/]+$/, (route) => {
    const id = route.request().url().split('/').pop();
    const body = route.request().postDataJSON() as { fee_amount: number };
    const next = { ...services.find((x) => x.id === id)!, id: `${id}-v2`, fee: peso(body.fee_amount) };
    services = services.map((x) => (x.id === id ? next : x));
    return route.fulfill(ok(next));
  });
  // Doctor search (3.6); test fixtures only. Sentinel queries give the other states.
  const searchHit = {
    doctor_id: publicDoctor.id, display_name: 'Dr. Ana Reyes', professional_title: 'MD', specialties: ['Pediatrics'], languages: ['en', 'fil'], years_experience: 8,
    is_verified: true, offers_online: true, fee_from: { amount: 50000, currency: 'PHP', formatted: '₱500.00' },
    locations: [{ clinic_id: publicClinic.id, clinic_name: 'Santos Family Clinic', clinic_location_id: 'loc1', location_name: 'Makati branch', city: 'Makati', fee_min: 65000, fee_max: 65000, distance_km: null }],
  };
  const searchMeta = (found: number, extra: object = {}) => ({ found, next_cursor: null, took_ms: 3, cache_hit: false, degraded: false, facets: {}, ...extra });
  await page.route(/\/api\/v1\/search\/doctors(\?.*)?$/, (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') ?? '';
    if (q === 'nobody') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], meta: searchMeta(0), message: null }) });
    if (q === 'slow') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [searchHit], meta: searchMeta(1, { degraded: true }), message: null }) });
    if (q === 'broken') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Server error.', errors: {}, code: 'SERVER_ERROR' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [searchHit], meta: searchMeta(1), message: null }) });
  });
  await page.route(/\/api\/v1\/search\/specialties(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    success: true,
    data: [
      { specialty_id: 'sp-ped', id: 'sp-ped', name: 'Pediatrics', kind: 'SPECIALTY', parent_name: null, doctor_count: 1 },
      { specialty_id: 'sp-ped', id: 'sub-neo', name: 'Neonatology', kind: 'SUBSPECIALTY', parent_name: 'Pediatrics', doctor_count: 1 },
    ],
    meta: searchMeta(2), message: null,
  }) }));
  await page.route('**/api/v1/auth/otp/verify', (route) => route.fulfill(ok({ verification_token: 'v'.repeat(64), expires_in_minutes: 10 })));
  await page.route('**/api/v1/auth/reset-password', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {}, meta: {}, message: 'Your password was changed.' }) }),
  );
  await page.route('**/api/v1/auth/forgot-password', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ success: true, data: { challenge_id: '01a1ec01-0000-7000-8000-0000000000c1', channel: 'EMAIL', destination_masked: 'p•••@example.test', expires_at: '2026-11-18T00:30:00Z' }, meta: {}, message: 'If the address can receive a code, one has been sent.' }) }),
  );
}
