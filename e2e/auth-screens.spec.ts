import { expect, test } from '@playwright/test';
import { axeViolations, expectNoHorizontalScroll, mockApi } from './helpers';

// The web stack keeps earlier screens mounted (hidden); act on what is visible.
const visible = { visible: true } as const;

const screens = [
  { path: '/sign-in', heading: 'Welcome back', primary: 'Sign in' },
  { path: '/register/contact', heading: 'Create your account', primary: 'Send code' },
  { path: '/reset-password', heading: 'Reset your password', primary: 'Send code' },
] as const;

for (const s of screens) {
  test.describe(`${s.path} (signed out)`, () => {
    test.beforeEach(async ({ page }) => {
      await mockApi(page, { signedIn: false });
      await page.goto(s.path);
      await expect(page.getByRole('heading', { name: s.heading })).toBeVisible({ timeout: 45_000 });
    });

    test('shows one primary action and no horizontal scroll', async ({ page }) => {
      await expect(page.getByRole('button', { name: s.primary, exact: true })).toBeVisible();
      await expectNoHorizontalScroll(page);
    });

    test('has no detectable WCAG 2.2 AA violations', async ({ page }) => {
      expect(await axeViolations(page)).toEqual([]);
    });

    test('explains empty required fields instead of submitting', async ({ page }) => {
      await page.getByRole('button', { name: s.primary, exact: true }).click();
      await expect(page.getByRole('alert').first()).toBeVisible();
    });
  });
}

test('screens have exactly one level-1 heading (no empty header title)', async ({ page }) => {
  await mockApi(page, { signedIn: false });
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 45_000 });
  const names = await page.getByRole('heading', { level: 1 }).filter(visible).allInnerTexts();
  expect(names.map((n) => n.trim())).toEqual(['Welcome back']);
});

test('sign-in links to password reset and carries the typed address over', async ({ page }) => {
  await mockApi(page, { signedIn: false });
  await page.goto('/sign-in');
  await page.getByLabel('Email or mobile number').fill('patient@example.test');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await expect(page.getByLabel('Email or mobile number').filter(visible)).toHaveValue('patient@example.test');
});

test('password reset step 2 shows code, new password with show/hide, and a resend countdown', async ({ page }) => {
  await mockApi(page, { signedIn: false });
  await page.goto('/sign-in');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByLabel('Email or mobile number').filter(visible).fill('patient@example.test');
  await page.getByRole('button', { name: 'Send code', exact: true }).filter(visible).click();

  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await expect(page.getByText('p•••@example.test', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Send a new code in \d+s/ })).toBeDisabled();

  const password = page.getByLabel('New password', { exact: true });
  await password.fill('abcdefgh12');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show new password' }).click();
  await expect(password).not.toHaveAttribute('type', 'password');

  expect(await axeViolations(page)).toEqual([]);
});

test('a completed reset returns to sign-in with a confirmation and the address filled in', async ({ page }) => {
  await mockApi(page, { signedIn: false });
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 45_000 });
  await page.getByLabel('Email or mobile number').fill('patient@example.test');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await page.getByRole('button', { name: 'Send code', exact: true }).filter(visible).click();

  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.getByLabel('6-digit code').fill('123456');
  await page.getByLabel('New password', { exact: true }).fill('abcdefgh12');
  await page.getByLabel('Confirm new password', { exact: true }).fill('abcdefgh12');
  await page.getByRole('button', { name: 'Change password' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back' }).filter(visible)).toBeVisible();
  await expect(page.getByText(/Your password was changed/).filter(visible)).toBeVisible();
  await expect(page.getByLabel('Email or mobile number').filter(visible)).toHaveValue('patient@example.test');
});
