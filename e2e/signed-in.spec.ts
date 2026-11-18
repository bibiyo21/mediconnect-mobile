import { expect, test } from '@playwright/test';
import { axeViolations, expectNoHorizontalScroll, mockApi } from './helpers';

const screens = [
  { path: '/', heading: 'Hello, Ana' },
  { path: '/account', heading: 'Account' },
  { path: '/devices', heading: 'Signed-in devices' },
  { path: '/profile', heading: 'Your profile' },
  { path: '/contact?kind=mobile', heading: 'Your mobile number' },
  { path: '/family', heading: 'Family members' },
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
