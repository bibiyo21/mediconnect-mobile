import { expect, test } from '@playwright/test';
import { axeViolations, expectNoHorizontalScroll, mockApi } from './helpers';

const screens = [
  { path: '/', heading: 'Hello, Ana' },
  { path: '/account', heading: 'Account' },
  { path: '/devices', heading: 'Signed-in devices' },
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
