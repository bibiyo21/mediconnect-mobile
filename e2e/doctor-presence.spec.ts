import { expect, test, type Page } from '@playwright/test';
import { axeViolations, expectNoHorizontalScroll } from './helpers';
import { count, failNext, mockDoctorDay, type PresenceKey } from './doctor-fixtures';

/*
 * Increment 5.9-M1: the doctor's clinic day (presence), check-in and break and away, against mocked API
 * fixtures (synthetic data only). Check-out lives in doctor-checkout.spec.ts.
 */

const STATES: { key: PresenceKey; status: string; actions: string[]; absent: string[] }[] = [
  { key: 'NOT_CHECKED_IN', status: 'Not checked in', actions: ['Check in'], absent: ['Start a break', 'Mark away', 'Check out'] },
  { key: 'IN', status: 'Checked in', actions: ['Start a break', 'Mark away', 'Check out'], absent: ['End break', 'Mark available', 'Check in'] },
  { key: 'ON_BREAK', status: 'On break', actions: ['End break', 'Check out'], absent: ['Start a break', 'Mark away'] },
  { key: 'AWAY', status: 'Away', actions: ['Mark available', 'Check out'], absent: ['Start a break', 'Mark away'] },
  { key: 'BUSY', status: 'In consultation', actions: ['Check out'], absent: ['Start a break', 'Mark away'] },
  { key: 'OUT', status: 'Checked out', actions: ['Check in'], absent: ['Check out', 'Start a break'] },
];

async function open(page: Page, path: string, heading: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 45_000 });
}

test.describe('clinic day dashboard states (mocked API)', () => {
  for (const s of STATES) {
    test(`presence ${s.key}: shows the status, the offered actions and no axe violations`, async ({ page }) => {
      await mockDoctorDay(page, { presence: s.key });
      await open(page, '/doctor/presence', 'Clinic day');
      await expect(page.getByText(s.status, { exact: true })).toBeVisible();
      for (const label of s.actions) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
      for (const label of s.absent) await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
      await expectNoHorizontalScroll(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  }

  test('ON_BREAK shows the expected end as an expectation, not a promise', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'ON_BREAK' });
    await open(page, '/doctor/presence', 'Clinic day');
    await expect(page.getByText(/Break expected to end around .* This is an expectation, not a promise\./)).toBeVisible();
  });

  test('BUSY says break and away are unavailable during a consultation', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'BUSY' });
    await open(page, '/doctor/presence', 'Clinic day');
    await expect(page.getByText('Break and away are unavailable during a consultation.')).toBeVisible();
  });

  test('shifts list the clinic and the scheduled break; empty assignments show the empty state', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    await open(page, '/doctor/presence', 'Clinic day');
    await expect(page.getByText('Makati branch', { exact: true })).toBeVisible();
    await expect(page.getByText(/Scheduled break/)).toBeVisible();
  });

  test('no active assignment shows the empty state', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'NOT_CHECKED_IN', day: { local_date: '2026-11-28', timezone: 'Asia/Manila', locations: [] } });
    await open(page, '/doctor/presence', 'Clinic day');
    await expect(page.getByText('You have no active clinic assignments, so there are no shifts to show.')).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('a read failure shows the error state with a retry', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    // Sticky: the query client retries a failed read, so a single refusal would be absorbed by a retry.
    fx.failAlways['GET /presence/me'] = { status: 500, code: 'SERVER_ERROR', message: 'Server error.' };
    await page.goto('/doctor/presence');
    await expect(page.getByRole('button', { name: /retry|try again/i })).toBeVisible({ timeout: 45_000 });
    expect(await axeViolations(page)).toEqual([]);
  });

  test('loading state shows while the day is read, then the fixture day', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    // Hold the day request, then hand it to the fixture (route.fallback reaches the mock registered earlier).
    await page.route('**/api/v1/presence/me/day', async (route) => {
      await gate;
      await route.fallback();
    });
    await page.goto('/doctor/presence');
    await expect(page.getByText('Loading your clinic day')).toBeVisible({ timeout: 45_000 });
    release();
    await expect(page.getByText('Makati branch', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Loading your clinic day')).toHaveCount(0);
  });
});

test.describe('break and away writes', () => {
  test('starting a break sends the expected length and shows the break', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    await open(page, '/doctor/presence', 'Clinic day');
    await page.getByRole('button', { name: 'Start a break', exact: true }).click();
    await page.getByLabel('Expected length in minutes').fill('15');
    await page.getByRole('button', { name: 'Start break', exact: true }).click();
    await expect(page.getByText('On break', { exact: true })).toBeVisible();
    expect(fx.bodies['POST /presence/break/start']?.[0]).toMatchObject({ expected_minutes: 15 });
  });

  test('a break start refused during a consultation says to finish it first (409 ACTIVE_CONSULTATION)', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    failNext(fx, 'POST /presence/break/start', { status: 409, code: 'ACTIVE_CONSULTATION', reason_code: 'in_progress' });
    await open(page, '/doctor/presence', 'Clinic day');
    await page.getByRole('button', { name: 'Start a break', exact: true }).click();
    await page.getByLabel('Expected length in minutes').fill('10');
    await page.getByRole('button', { name: 'Start break', exact: true }).click();
    await expect(page.getByText('Finish the consultation first.')).toBeVisible();
  });

  test('a break start refused while a patient is called says to start, skip or mark no-show first (HAG-43)', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    failNext(fx, 'POST /presence/break/start', { status: 409, code: 'ACTIVE_CONSULTATION', reason_code: 'called' });
    await open(page, '/doctor/presence', 'Clinic day');
    await page.getByRole('button', { name: 'Start a break', exact: true }).click();
    await page.getByLabel('Expected length in minutes').fill('10');
    await page.getByRole('button', { name: 'Start break', exact: true }).click();
    await expect(page.getByText('A patient is called. Start, skip or mark no-show first.')).toBeVisible();
  });

  test('a stale status (409 INVALID_STATE_TRANSITION) says the status changed and refreshes', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    failNext(fx, 'POST /presence/unavailable', { status: 409, code: 'INVALID_STATE_TRANSITION', reason_code: 'invalid_transition' });
    await open(page, '/doctor/presence', 'Clinic day');
    await page.getByRole('button', { name: 'Mark away', exact: true }).click();
    await expect(page.getByText('Your status changed. We refreshed it.')).toBeVisible();
    expect(count(fx, 'GET /presence/me')).toBeGreaterThan(1);
  });

  test('mark away then mark available', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    await open(page, '/doctor/presence', 'Clinic day');
    await page.getByRole('button', { name: 'Mark away', exact: true }).click();
    await expect(page.getByText('Away', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mark available', exact: true }).click();
    await expect(page.getByText('Checked in', { exact: true })).toBeVisible();
  });

  test('offline: the break and away actions are disabled and writes are not sent', async ({ page, context }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    await open(page, '/doctor/presence', 'Clinic day');
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Start a break', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mark away', exact: true })).toBeDisabled();
    expect(count(fx, 'POST /presence/break/start')).toBe(0);
    await context.setOffline(false);
  });
});

test.describe('check-in picker', () => {
  test('lists clinics with an allowed row and a refused row with its reason', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'NOT_CHECKED_IN' });
    await open(page, '/doctor/check-in', 'Check in');
    await expect(page.getByRole('button', { name: 'Check in at Makati branch', exact: true })).toBeVisible();
    await expect(page.getByText(/outside your scheduled hours here/)).toBeVisible();
    await expect(page.getByRole('button', { name: `Check in at Quezon City branch`, exact: true })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('check-in asks to confirm, then sends the chosen clinic', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'NOT_CHECKED_IN' });
    await open(page, '/doctor/check-in', 'Check in');
    await page.getByRole('button', { name: 'Check in at Makati branch', exact: true }).click();
    await expect(page.getByText('Check in at Makati branch now?')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm check-in', exact: true }).click();
    await expect(page.getByText('Checked in', { exact: true })).toBeVisible({ timeout: 45_000 });
    expect(fx.bodies['POST /presence/check-in']?.[0]).toEqual({ clinic_location_id: 'loc1' });
  });

  test('a check-in while checked in elsewhere (409 open_session) offers the way back to the clinic day', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'NOT_CHECKED_IN' });
    failNext(fx, 'POST /presence/check-in', { status: 409, code: 'INVALID_STATE_TRANSITION', reason_code: 'open_session' });
    await open(page, '/doctor/check-in', 'Check in');
    await page.getByRole('button', { name: 'Check in at Makati branch', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm check-in', exact: true }).click();
    await expect(page.getByText('You are checked in at another clinic or session. Check out there first.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to clinic day', exact: true })).toBeVisible();
  });

  test('no clinic assignments shows the empty state', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'NOT_CHECKED_IN', day: { local_date: '2026-11-28', timezone: 'Asia/Manila', locations: [] } });
    await open(page, '/doctor/check-in', 'Check in');
    await expect(page.getByText('You have no active clinic assignments, so there is nothing to check in to.')).toBeVisible();
  });

  test('offline: the check-in button is disabled', async ({ page, context }) => {
    await mockDoctorDay(page, { presence: 'NOT_CHECKED_IN' });
    await open(page, '/doctor/check-in', 'Check in');
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Check in at Makati branch', exact: true })).toBeDisabled();
    await context.setOffline(false);
  });
});

