import { expect, test } from '@playwright/test';
import { axeViolations, expectNoHorizontalScroll, mockApi } from './helpers';

const screens = [
  { path: '/', heading: 'Hello, Ana' },
  { path: '/account', heading: 'Account' },
  { path: '/devices', heading: 'Signed-in devices' },
  { path: '/profile', heading: 'Your profile' },
  { path: '/contact?kind=mobile', heading: 'Your mobile number' },
  { path: '/family', heading: 'Family members' },
  { path: '/delete-account', heading: 'Delete your account' },
  { path: '/family/new', heading: 'Add a family member' },
  { path: '/family/01a1ec01-0000-7000-8000-0000000000d1', heading: 'Lia Reyes' },
] as const;

for (const s of screens) {
  test.describe(`${s.path} (signed in, mocked API)`, () => {
    test.beforeEach(async ({ page }) => {
      await mockApi(page, { signedIn: true });
      await page.goto(s.path);
      await expect(page.getByRole('heading', { name: s.heading, exact: true })).toBeVisible({ timeout: 45_000 });
    });

    test('renders without horizontal scroll', async ({ page }) => {
      await expectNoHorizontalScroll(page);
    });

    test('has no detectable WCAG 2.2 AA violations', async ({ page }) => {
      expect(await axeViolations(page)).toEqual([]);
    });
  });
}

test('home keeps the emergency notice visible', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/');
  await expect(page.getByText(/call 911/)).toBeVisible({ timeout: 45_000 });
});

test('devices names this device once, without a repeated subtitle', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/devices');
  await expect(page.getByText('This device')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Web browser')).toHaveCount(1);
});

test('profile edit validates, then sends only the PATCH body the API expects', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/profile');
  await expect(page.getByLabel('First name')).toHaveValue('Ana', { timeout: 45_000 });

  await page.getByLabel('Name', { exact: true }).fill('Jose Reyes');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Add a mobile number for your emergency contact.')).toBeVisible();

  await page.getByLabel('Mobile number').fill('0917 765 4321');
  await page.getByRole('radio', { name: 'Filipino' }).click();
  const request = page.waitForRequest((r) => r.url().endsWith('/api/v1/patients/me') && r.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save changes' }).click();

  const body = (await request).postDataJSON();
  expect(body).toMatchObject({ first_name: 'Ana', preferred_language: 'fil', emergency_contact: { name: 'Jose Reyes', phone: '09177654321' }, address: null });
});

test('account links to profile editing', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/account');
  await page.getByRole('button', { name: 'Edit profile' }).click({ timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible();
});

test('adding a mobile number: password and new number, then the code, then back to the account', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/account');
  await page.getByRole('link', { name: 'Add a mobile number' }).click({ timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Your mobile number', exact: true })).toBeVisible();

  await page.getByLabel('New mobile number').fill('0918 123 4567');
  await page.getByLabel('Current password', { exact: true }).fill('Correct-horse-42');
  const codeRequest = page.waitForRequest((r) => r.url().endsWith('/api/v1/auth/contact/otp'));
  await page.getByRole('button', { name: 'Send code' }).click();
  expect((await codeRequest).postDataJSON()).toEqual({ mobile: '09181234567', current_password: 'Correct-horse-42' });

  await expect(page.getByRole('heading', { name: 'Enter your code', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send a new code in/ })).toBeDisabled();
  await page.getByLabel('6-digit code').fill('123456');
  const save = page.waitForRequest((r) => r.url().endsWith('/api/v1/auth/contact') && r.method() === 'PUT');
  await page.getByRole('button', { name: 'Save new mobile number' }).click();
  expect((await save).postDataJSON()).toEqual({ mobile: '09181234567', verification_token: 'v'.repeat(64) });
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
});

test('pushed screens name the back link after the app, not the route group', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/account');
  await page.getByRole('button', { name: 'Edit profile' }).click({ timeout: 45_000 });
  await expect(page.getByRole('link', { name: /MediConnect, back/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /\(tabs\)/ })).toHaveCount(0);
});

test('adding a family member needs the guardian confirmation and sends an Idempotency-Key', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/family/new');
  await page.getByLabel('First name').fill('Ben', { timeout: 45_000 });
  await page.getByLabel('Last name').fill('Reyes');
  await page.getByLabel('Date of birth').fill('20200115');
  await expect(page.getByLabel('Date of birth')).toHaveValue('2020-01-15');
  await page.getByRole('radio', { name: 'Child', exact: true }).click();
  await page.getByRole('button', { name: 'Add family member' }).click();
  await expect(page.getByText("Confirm that you are authorised to manage this person's health information.")).toBeVisible();

  await page.getByRole('checkbox').click();
  const request = page.waitForRequest((r) => r.url().endsWith('/api/v1/patients/me/dependents') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Add family member' }).click();
  const sent = await request;
  expect(sent.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  expect(sent.postDataJSON()).toMatchObject({ first_name: 'Ben', date_of_birth: '2020-01-15', relationship: 'CHILD', guardian_attestation: true });
});

test('removing a family member asks for confirmation and says records are kept', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/family/01a1ec01-0000-7000-8000-0000000000d1');
  await page.getByRole('button', { name: 'Remove family member' }).click({ timeout: 45_000 });
  await expect(page.getByText(/Their records are kept/)).toBeVisible();
  const request = page.waitForRequest((r) => r.method() === 'DELETE');
  await page.getByRole('button', { name: 'Yes, remove Lia' }).click();
  expect((await request).url()).toContain('/api/v1/patients/me/dependents/01a1ec01-0000-7000-8000-0000000000d1');
});

test('deleting the account needs confirmation and the password, then shows the deletion date on the welcome screen', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/account');
  await page.getByRole('link', { name: 'Delete my account' }).click({ timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Delete your account', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByText('Confirm that you understand what happens to your account.')).toBeVisible();

  await page.getByRole('checkbox').click();
  await page.getByLabel('Password', { exact: true }).fill('Correct-horse-42');
  const request = page.waitForRequest((r) => r.url().endsWith('/api/v1/auth/account/deletion-request'));
  // After the request the server no longer recognises the session.
  await page.unroute('**/api/v1/auth/me');
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Unauthenticated.', errors: {}, code: 'UNAUTHENTICATED' }) }));
  await page.getByRole('button', { name: 'Delete my account' }).click();

  expect((await request).postDataJSON()).toEqual({ current_password: 'Correct-horse-42' });
  await expect(page.getByText(/scheduled for deletion on 18 December 2026/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test.describe('doctor screens (mocked API)', () => {
  for (const s of [
    { path: '/doctor/start', heading: 'Register as a doctor', doctor: null },
    { path: '/doctor', heading: 'Dr. Ana Reyes', doctor: 'REGISTERED' as const },
    { path: '/doctor/edit', heading: 'Edit doctor profile', doctor: 'REGISTERED' as const },
    { path: '/doctor/clinics', heading: 'Your clinics', doctor: 'VERIFIED' as const },
    { path: '/doctor/services', heading: 'Services and fees', doctor: 'VERIFIED' as const },
  ]) {
    test(`${s.path}: renders, no horizontal scroll, no axe violations`, async ({ page }) => {
      await mockApi(page, { signedIn: true, doctor: s.doctor });
      await page.goto(s.path);
      await expect(page.getByRole('heading', { name: s.heading, exact: true })).toBeVisible({ timeout: 45_000 });
      await expectNoHorizontalScroll(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test('a patient registers as a doctor from the account screen', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/account');
  await page.getByRole('button', { name: 'Register as a doctor' }).click({ timeout: 45_000 });
  await page.getByLabel('Name patients will see').fill('Dr. Ana Reyes');
  await page.getByRole('button', { name: 'Start registration' }).click();
  await expect(page.getByText('Confirm that you are a physician licensed by the PRC.')).toBeVisible();

  await page.getByRole('checkbox').click();
  const request = page.waitForRequest((r) => r.url().endsWith('/api/v1/doctors') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Start registration' }).click();
  expect((await request).postDataJSON()).toEqual({ display_name: 'Dr. Ana Reyes', professional_title: null, confirm_licensed: true });
  await expect(page.getByText(/Complete your profile and add your PRC licence number/)).toBeVisible();
});

test('doctor specialties are labelled self-reported until review (D-40)', async ({ page }) => {
  await mockApi(page, { signedIn: true, doctor: 'REGISTERED' });
  await page.goto('/doctor');
  await expect(page.getByText('Internal Medicine · self-reported, confirmed at review')).toBeVisible({ timeout: 45_000 });
});

test('a rejected doctor sees the reason and the next step', async ({ page }) => {
  await mockApi(page, { signedIn: true, doctor: 'REJECTED' });
  await page.goto('/doctor');
  await expect(page.getByText('Changes needed: The PRC ID photo is unreadable.')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/update your documents and submit again/)).toBeVisible();
});

test('editing the doctor profile sends the licence only when typed and keeps the specialty list complete', async ({ page }) => {
  await mockApi(page, { signedIn: true, doctor: 'REGISTERED' });
  await page.goto('/doctor/edit');
  await expect(page.getByLabel('PRC licence number')).toHaveValue('', { timeout: 45_000 });
  await page.getByRole('radio', { name: 'Cardiology' }).click();
  await page.getByRole('checkbox', { name: 'Filipino' }).click();
  await page.getByLabel('PRC licence number').fill('0123456');
  const request = page.waitForRequest((r) => r.url().endsWith('/api/v1/doctors/me') && r.method() === 'PATCH');
  await page.getByRole('button', { name: 'Save doctor profile' }).click();
  const body = (await request).postDataJSON();
  expect(body).toMatchObject({ prc_license_number: '0123456', languages: ['en', 'fil'] });
  expect(body.specialties).toEqual([
    { specialty_id: 'sp-card', subspecialty_id: null, is_primary: true, board_certified: false },
    { specialty_id: 'sp-im', subspecialty_id: null, is_primary: false, board_certified: false },
  ]);
});

test('a verified doctor accepts a clinic invitation', async ({ page }) => {
  await mockApi(page, { signedIn: true, doctor: 'VERIFIED' });
  await page.goto('/doctor/clinics');
  await page.getByRole('button', { name: 'Accept invitation' }).click({ timeout: 45_000 });
  await expect(page.getByText('You now practise at Reyes Medical Center, Quezon City.', { exact: false })).toBeVisible();
});

test('a doctor adds a service with a fee in pesos, sent as centavos', async ({ page }) => {
  await mockApi(page, { signedIn: true, doctor: 'VERIFIED' });
  await page.goto('/doctor/services');
  await expect(page.getByText('₱650.00', { exact: false })).toBeVisible({ timeout: 45_000 });

  await page.getByLabel('Fee (₱)', { exact: true }).fill('65o');
  await page.getByRole('button', { name: 'Add service' }).click();
  await expect(page.getByText('Enter the fee in pesos, for example 650 or 650.50.')).toBeVisible();

  await page.getByLabel('Service name', { exact: true }).fill('Follow-up visit');
  await page.getByLabel('Fee (₱)', { exact: true }).fill('450.50');
  const request = page.waitForRequest((r) => r.url().endsWith('/api/v1/doctors/me/services') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Add service' }).click();
  expect((await request).postDataJSON()).toMatchObject({ consultation_type: 'IN_PERSON', clinic_location_id: 'loc1', name: 'Follow-up visit', fee_amount: 45050 });
  await expect(page.getByText('Added Follow-up visit', { exact: false })).toBeVisible();
});

test.describe('public directory (mocked API)', () => {
  for (const s of [
    { path: '/directory/doctor/01a1ed01-0000-7000-8000-00000000d001', heading: 'Dr. Ana Reyes' },
    { path: '/directory/clinic/01a1ec01-0000-7000-8000-00000000c001', heading: 'Santos Family Clinic' },
  ]) {
    test(`${s.path}: renders, no horizontal scroll, no axe violations`, async ({ page }) => {
      await mockApi(page, { signedIn: true });
      await page.goto(s.path);
      await expect(page.getByRole('heading', { name: s.heading, exact: true })).toBeVisible({ timeout: 45_000 });
      await expectNoHorizontalScroll(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test('a patient browses from home to a doctor, their fee and their clinic', async ({ page }) => {
  await mockApi(page, { signedIn: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click({ timeout: 45_000 });
  await page.getByRole('link', { name: /Dr\. Ana Reyes/ }).click();
  await expect(page.getByText('₱650.00')).toBeVisible();
  await expect(page.getByText('Booking through MediConnect is not available yet', { exact: false }).last()).toBeVisible();
  await page.getByRole('link', { name: 'About Santos Family Clinic' }).click();
  await expect(page.getByRole('heading', { name: 'Santos Family Clinic', exact: true })).toBeVisible();
});
