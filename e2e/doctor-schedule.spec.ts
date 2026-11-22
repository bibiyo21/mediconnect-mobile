import { expect, test, type Page } from '@playwright/test';
import { axeViolations, expectNoHorizontalScroll, mockApi } from './helpers';

/*
 * Increment 4.9: the doctor's weekly schedule, editor and time off, against
 * mocked API fixtures (test data only). WIP screenshots: WIP_SHOTS=1.
 */

const ok = (data: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data, meta: {}, message: null }) });

const modes = [
  { doctor_service_id: 'sv1', doctor_profile_id: 'doc1', service_name: 'Consultation', consultation_type: 'IN_PERSON', clinic_location_id: 'loc1', location_name: 'Makati branch', service_mode: 'APPOINTMENT', service_mode_id: 'mode1', effective_from: '2026-11-20' },
  { doctor_service_id: 'sv2', doctor_profile_id: 'doc1', service_name: 'Teleconsultation', consultation_type: 'ONLINE', clinic_location_id: null, location_name: null, service_mode: null, service_mode_id: null, effective_from: null },
];

const schedule = {
  id: 'sch1', doctor_profile_id: 'doc1', name: 'Makati clinic', status: 'ACTIVE', version: 3, effective_from: '2026-11-23', effective_until: null,
  shifts: [
    { id: 'sh1', day_of_week: 1, doctor_service_mode_id: 'mode1', clinic_location_id: 'loc1', starts_at: '09:00', ends_at: '12:00', timezone: 'Asia/Manila', slot_duration_minutes: 20, buffer_minutes: 5, max_appointments: null, walkin_capacity: null, breaks: [] },
    { id: 'sh2', day_of_week: 3, doctor_service_mode_id: 'mode1', clinic_location_id: 'loc1', starts_at: '13:00', ends_at: '17:00', timezone: 'Asia/Manila', slot_duration_minutes: 20, buffer_minutes: 5, max_appointments: 8, walkin_capacity: null, breaks: [{ starts_at: '15:00', ends_at: '15:15', label: null }] },
  ],
};

const exceptions = [
  { id: 'ex1', doctor_profile_id: 'doc1', clinic_location_id: null, doctor_service_mode_id: null, exception_type: 'VACATION', effect: 'BLOCK', priority: 2, starts_at: '2026-12-23T16:00:00Z', ends_at: '2026-12-27T15:59:00Z', reason: null, status: 'ACTIVE' },
  { id: 'ex2', doctor_profile_id: 'doc1', clinic_location_id: 'loc1', doctor_service_mode_id: null, exception_type: 'CLINIC_CLOSURE', effect: 'BLOCK', priority: 1, starts_at: '2026-12-29T16:00:00Z', ends_at: '2026-12-30T15:59:00Z', reason: null, status: 'ACTIVE' },
];

const openTimes = ['01:00', '01:25', '01:50'].map((t, i) => ({ slot_id: `slot${i}`, starts_at: `2026-11-23T${t}:00Z`, ends_at: '', local_date: '2026-11-23', timezone: 'Asia/Manila', clinic_location_id: 'loc1', doctor_service_id: 'sv1', service_name: 'Consultation', consultation_type: 'IN_PERSON' }));

/** Scheduling fixtures on top of the shared mocks; `stale` makes a save answer 409 as after a concurrent edit. */
async function mockScheduling(page: Page, { stale = false }: { stale?: boolean } = {}) {
  await mockApi(page, { signedIn: true, doctor: 'VERIFIED' });
  // Routes added later win: the doctor is ACTIVE here so the open-times preview shows.
  await page.route('**/api/v1/doctors/me', (route) => route.fulfill(ok({
    id: 'doc1', display_name: 'Dr. Ana Reyes', professional_title: 'MD', biography: null, prc_license_number_masked: '•••567', license_verification_status: 'VERIFIED', onboarding_status: 'ACTIVE', licence_locked: true,
    medical_school: null, years_experience: 8, gender: null, languages: ['en'], specialties: [], specialty_review_pending: false, education: [], experience: [], profile_completeness: 80, verification_history: [],
  })));
  await page.route('**/api/v1/doctors/me/service-modes', (route) => route.fulfill(ok(modes)));
  await page.route(/\/api\/v1\/doctors\/me\/services\/[^/]+\/mode$/, (route) => {
    const body = route.request().postDataJSON() as { service_mode: string };
    return route.fulfill(ok({ ...modes[1], service_mode: body.service_mode, service_mode_id: 'mode2' }));
  });
  await page.route('**/api/v1/schedules', (route) => (route.request().method() === 'POST' ? route.fulfill(ok({ ...schedule, id: 'sch2', version: 1, ...(route.request().postDataJSON() as object) }, 201)) : route.fulfill(ok([schedule]))));
  await page.route(/\/api\/v1\/schedules\/sch1$/, (route) => {
    const method = route.request().method();
    if (method === 'DELETE') return route.fulfill(ok({ id: 'sch1', status: 'ARCHIVED', affected_appointments: ['ap1', 'ap2'] }));
    if (method === 'PATCH' && stale) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'This schedule was changed by someone else. Reload it and try again.', errors: {}, code: 'CONCURRENT_MODIFICATION' }) });
    if (method === 'PATCH') return route.fulfill(ok({ ...schedule, version: 4 }));
    return route.fulfill(ok(schedule));
  });
  await page.route('**/api/v1/schedule-exceptions', (route) => (route.request().method() === 'POST'
    ? route.fulfill(ok({ ...exceptions[0], id: 'ex3', ...(route.request().postDataJSON() as object), affected_appointments: ['ap9'] }, 201))
    : route.fulfill(ok(exceptions))));
  await page.route(/\/api\/v1\/doctors\/doc1\/availability/, (route) => route.fulfill(ok(openTimes)));
}

test.describe('doctor schedule screens (mocked API)', () => {
  for (const s of [
    { path: '/doctor/schedule', heading: 'Weekly schedule' },
    { path: '/doctor/schedule-edit?id=sch1', heading: 'Edit schedule' },
    { path: '/doctor/schedule-edit', heading: 'Add a schedule' },
    { path: '/doctor/time-off', heading: 'Time off and extra hours' },
  ]) {
    test(`${s.path}: renders, no horizontal scroll, no axe violations`, async ({ page }) => {
      await mockScheduling(page);
      await page.goto(s.path);
      await expect(page.getByRole('heading', { name: s.heading, exact: true })).toBeVisible({ timeout: 45_000 });
      await expectNoHorizontalScroll(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test('the schedule shows shifts, an unset service, open times, and archives without cancelling', async ({ page }) => {
  await mockScheduling(page);
  await page.goto('/doctor/schedule');
  await expect(page.getByText(/Monday 9:00 AM to 12:00 PM · Consultation · 20-minute slots, 5 min between/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/break 3:00 PM to 3:15 PM/)).toBeVisible();
  await expect(page.getByText('Not set yet: patients cannot book this service.')).toBeVisible();
  await expect(page.getByText('3 open: 9:00 AM, 9:25 AM, 9:50 AM')).toBeVisible();

  const request = page.waitForRequest((r) => /\/doctors\/me\/services\/sv2\/mode$/.test(r.url()) && r.method() === 'PUT');
  await page.getByRole('radio', { name: 'Appointments' }).nth(1).click();
  expect((await request).postDataJSON()).toEqual({ service_mode: 'APPOINTMENT' });

  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByText(/Appointments already booked are kept and marked for rescheduling; none are cancelled/)).toBeVisible();
  const archive = page.waitForRequest((r) => r.url().endsWith('/schedules/sch1') && r.method() === 'DELETE');
  await page.getByRole('button', { name: 'Archive schedule' }).click();
  expect((await archive).headers()['if-match']).toBe('3');
  await expect(page.getByText('Schedule archived. 2 booked appointments are kept and marked for rescheduling; nothing was cancelled.')).toBeVisible();
});

test('the editor validates locally, sends the version, and recovers from a concurrent edit', async ({ page }) => {
  await mockScheduling(page, { stale: true });
  await page.goto('/doctor/schedule-edit?id=sch1');
  await expect(page.getByLabel('Name')).toHaveValue('Makati clinic', { timeout: 45_000 });
  await expect(page.getByText(/About 7 appointments each Monday/)).toBeVisible();

  await page.getByLabel('To').first().fill('08:00');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('The shift must end after it starts.')).toBeVisible();

  await page.getByLabel('To').first().fill('12:00');
  const save = page.waitForRequest((r) => r.url().endsWith('/schedules/sch1') && r.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const sent = await save;
  expect(sent.headers()['if-match']).toBe('3');
  expect((sent.postDataJSON() as { shifts: unknown[] }).shifts).toHaveLength(2);
  await expect(page.getByText(/This schedule was changed somewhere else since you opened it/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload schedule' })).toBeVisible();
});

test('time off warns that bookings are kept, sends Manila times, and reports affected appointments', async ({ page }) => {
  await mockScheduling(page);
  await page.goto('/doctor/time-off');
  await expect(page.getByRole('button', { name: 'Remove vacation' })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Set by your clinic.')).toBeVisible();
  await expect(page.getByText(/are not cancelled. They are marked for rescheduling/)).toBeVisible();

  await page.getByLabel('Start date').fill('2026-12-24');
  await page.getByLabel('End date').fill('2026-12-26');
  const request = page.waitForRequest((r) => r.url().endsWith('/schedule-exceptions') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Save time off' }).click();
  expect((await request).postDataJSON()).toEqual({ exception_type: 'VACATION', clinic_location_id: null, doctor_service_mode_id: null, starts_at: '2026-12-24T00:00:00+08:00', ends_at: '2026-12-26T23:59:00+08:00', reason: null });
  await expect(page.getByText(/1 booked appointment falls in this time. It is kept and marked for rescheduling; nothing was cancelled./)).toBeVisible();
});

const shots = [
  { name: 'doctor-schedule', path: '/doctor/schedule', heading: 'Weekly schedule' },
  { name: 'doctor-schedule-edit', path: '/doctor/schedule-edit?id=sch1', heading: 'Edit schedule' },
  { name: 'doctor-time-off', path: '/doctor/time-off', heading: 'Time off and extra hours' },
];

for (const s of shots) {
  test(`wip shot: scheduling/${s.name}`, async ({ page }, info) => {
    test.skip(!process.env.WIP_SHOTS, 'set WIP_SHOTS=1 to capture');
    test.skip(info.project.name === 'tablet', 'desktop + mobile only');
    await mockScheduling(page);
    await page.goto(s.path);
    await expect(page.getByRole('heading', { name: s.heading, exact: true })).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: `${info.config.rootDir}/../../docs/wip-screenshots/phase-4/scheduling/${s.name}-${info.project.name}.png`, fullPage: true });
  });
}
