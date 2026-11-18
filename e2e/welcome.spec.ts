import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('welcome screen (unauthenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 45_000 });
  });

  test('shows brand, both actions and the emergency disclaimer', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'MediConnect' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible();
    await expect(page.getByText(/does not provide emergency care/)).toBeVisible();
  });

  test('primary actions meet the 44px minimum target', async ({ page }) => {
    for (const name of ['Sign in', 'Create an account']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('has no horizontal scroll', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('has no detectable WCAG 2.2 AA violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('sign in opens the sign-in form', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/sign-in/);
  });

  test('screenshot', async ({ page }, info) => {
    test.skip(!process.env.SHOTS, 'set SHOTS=1 (pnpm e2e:shots) to capture');
    await page.screenshot({ path: `test-results/shots/${info.project.name}-welcome.png`, fullPage: true });
  });
});
