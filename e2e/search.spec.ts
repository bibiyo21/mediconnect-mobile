import { expect, test, type Page } from '@playwright/test';
import { axeViolations, expectNoHorizontalScroll, mockApi } from './helpers';

/** Doctor search (increment 3.6) against mocked API fixtures. */
const visible = { visible: true } as const;

async function openSearch(page: Page, path = '/search') {
  await mockApi(page, { signedIn: true });
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Find a doctor', exact: true })).toBeVisible({ timeout: 45_000 });
}

const searchField = (page: Page) => page.getByLabel('Search', { exact: true }).filter(visible);

test.describe('/search (signed in, mocked API)', () => {
  test('lists results with fee and licence status, and has no WCAG 2.2 AA violations', async ({ page }) => {
    await openSearch(page);
    await expect(page.getByText('1 doctor found')).toBeVisible();
    await expect(page.getByText('From ₱500.00')).toBeVisible();
    await expect(page.getByText('PRC licence checked', { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('debounces typing into one request and cancels nothing it still needs', async ({ page }) => {
    await openSearch(page);
    await expect(page.getByText('1 doctor found')).toBeVisible();
    const queries: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/search/doctors')) queries.push(new URL(r.url()).searchParams.get('q') ?? '');
    });
    await searchField(page).pressSequentially('reyes', { delay: 40 });
    await expect(page.getByText('1 doctor found')).toBeVisible();
    await page.waitForTimeout(500);
    expect(queries).toEqual(['reyes']);
  });

  test('suggests specialties and filters by the one picked', async ({ page }) => {
    await openSearch(page);
    const filtered = page.waitForRequest((r) => r.url().includes('/search/doctors') && r.url().includes('subspecialty=sub-neo'));
    await searchField(page).fill('neo');
    await page.getByRole('button', { name: /Filter by Neonatology \(Pediatrics\)/ }).click();
    const url = new URL((await filtered).url());
    expect(url.searchParams.get('specialty')).toBe('sp-ped');
    expect(url.searchParams.has('q')).toBe(false);
    await expect(page.getByText('Specialty: Neonatology (Pediatrics)')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('says so when nothing matches, when search is degraded, and when it fails', async ({ page }) => {
    await openSearch(page);
    await searchField(page).fill('nobody');
    await expect(page.getByText('No doctors match. Try a different word, or remove a filter.')).toBeVisible();
    await searchField(page).fill('slow');
    await expect(page.getByText(/Search is running in a simpler mode/)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.goto('/search?q=broken');
    await expect(page.getByText('Something went wrong on our side. Please try again.')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('home search opens results for the typed words, and a result opens the profile', async ({ page }) => {
    await mockApi(page, { signedIn: true });
    const request = page.waitForRequest((r) => r.url().includes('/search/doctors') && r.url().includes('q=pedia'));
    await page.goto('/');
    await page.getByLabel('Search doctors').fill('pedia');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await request;
    await page.getByRole('link', { name: /Dr\. Ana Reyes, Pediatrics/ }).click();
    await expect(page.getByRole('heading', { name: 'Dr. Ana Reyes', exact: true })).toBeVisible();
  });

  test('shows the next open time and sends availability filters in Philippine time (4.10)', async ({ page }) => {
    await openSearch(page);
    await expect(page.getByText(/^Next open time: (Today|Tomorrow|\w{3} \d{1,2} \w{3}), 9:00 AM$/)).toBeVisible();
    const request = page.waitForRequest((r) => r.url().includes('/search/doctors') && r.url().includes('available_time_from=06%3A00'));
    await page.getByRole('radio', { name: 'Tomorrow' }).click();
    await page.getByRole('radio', { name: 'Morning' }).click();
    const url = new URL((await request).url());
    expect(url.searchParams.get('available_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(url.searchParams.get('available_time_to')).toBe('12:00');
    await expect(page.getByText(/Open times are a guide and can change/)).toBeVisible();
    const sorted = page.waitForRequest((r) => r.url().includes('/search/doctors') && r.url().includes('sort=next_available'));
    await page.getByRole('radio', { name: 'Soonest open time' }).click();
    await sorted;
    expect(await axeViolations(page)).toEqual([]);
  });

  test('a doctor profile shows open times by day as a guide, not as booking buttons (4.10)', async ({ page }) => {
    await mockApi(page, { signedIn: true });
    await page.goto('/directory/doctor/01a1ed01-0000-7000-8000-00000000d001');
    await expect(page.getByRole('heading', { name: 'Open times', exact: true })).toBeVisible({ timeout: 45_000 });
    const list = page.getByRole('list', { name: /^Open times on / });
    await expect(list.getByRole('listitem')).toHaveText(['9:00 AM', '9:25 AM', '9:50 AM']);
    await expect(page.getByRole('button', { name: '9:00 AM' })).toHaveCount(0);
    await expect(page.getByText(/A guide only: times change as patients book/)).toBeVisible();
    await page.getByRole('radio').nth(1).click();
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expectNoHorizontalScroll(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('the old directory address opens search', async ({ page }) => {
    await openSearch(page, '/directory');
    await expect(page).toHaveURL(/\/search/);
  });
});
