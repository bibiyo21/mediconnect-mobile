import { expect, test, type Page } from '@playwright/test';
import { axeViolations, expectNoHorizontalScroll } from './helpers';
import { count, emptyPreview, failNext, mockDoctorDay, type PreviewView } from './doctor-fixtures';

/*
 * Increment 5.9-M1: the four-step check-out flow (brief D-E), against mocked API fixtures (synthetic data only).
 * The flow is preview, blocks, reason, then walk-ins and confirm. No appointment is cancelled silently.
 */

async function openStep1(page: Page) {
  await page.goto('/doctor/check-out');
  await expect(page.getByText('Step 1 of 4: Check what is open')).toBeVisible({ timeout: 45_000 });
}

function blocked(reason: string, code = 'ACTIVE_CONSULTATION'): PreviewView {
  return { ...emptyPreview(), blocking: [{ code, reason_code: reason }] };
}

test.describe('check-out flow (mocked API)', () => {
  test('step 1 shows counts only, with no names, and no axe violations', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    await openStep1(page);
    await expect(page.getByText('Counts only. No names are shown here.')).toBeVisible();
    await expect(page.getByText(/3 appointments today/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('blocked by an in-progress consultation: step 2 stops the flow and links the reason', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'BUSY', preview: blocked('in_progress') });
    await openStep1(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Step 2 of 4: Blocks')).toBeVisible();
    await expect(page.getByText('A consultation is in progress. Finish it first.')).toBeVisible();
    // A blocked step has no Next: the way forward is the walk-in queue.
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open the walk-in queue', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open the walk-in queue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Walk-in queue', exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('blocked by a called patient: step 2 says to start, skip or mark no-show first', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN', preview: blocked('called', 'CALLED') });
    await openStep1(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('A patient is called. Start, skip or mark no-show first.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  });

  test('HOLD: the default disposition submits with no second confirmation and shows the counts', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    await openStep1(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('radio', { name: 'End of shift', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Step 4 of 4: Walk-ins and confirm')).toBeVisible();
    await expect(page.getByText('No appointment is cancelled. 3 booked patients are flagged for rescheduling. They are not told automatically')).toBeVisible();
    await page.getByRole('button', { name: 'Check out', exact: true }).click();
    await expect(page.getByText('You are checked out. No appointment was cancelled. Booked patients are not told automatically.')).toBeVisible();
    await expect(page.getByText('Queues paused: 1')).toBeVisible();
    await expect(page.getByText('Walk-ins held: 2')).toBeVisible();
    await expect(page.getByText('Appointments flagged for rescheduling: 3')).toBeVisible();
    expect(fx.bodies['POST /presence/check-out']?.[0]).toEqual({
      clinic_location_id: 'loc1', reason: 'END_OF_SHIFT', walkin_disposition: 'HOLD_FOR_REASSIGNMENT',
    });
    expect(await axeViolations(page)).toEqual([]);
  });

  test('NOTIFY_AND_CANCEL counts skipped walk-ins too: the default fixture reads 4, not 3', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    await openStep1(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('radio', { name: 'Personal', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('radio', { name: 'Cancel walk-ins with notice', exact: true }).click();
    // Default fixture: 1 not arrived + 2 waiting + 1 skipped = 4 walk-ins the server cancels.
    await expect(page.getByText('4 walk-ins will be cancelled.')).toBeVisible();
    // Before the boxes are ticked the step says what is missing, and the submit stays disabled.
    await expect(page.getByText('Tick the box above to continue.')).toBeVisible();
    const submit = page.getByRole('button', { name: 'Check out', exact: true });
    await expect(submit).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Confirm walk-in cancellation' }).click();
    await expect(page.getByText('Tick the box above to continue.')).toHaveCount(0);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText('You are checked out. No appointment was cancelled. Booked patients are not told automatically.')).toBeVisible();
    expect(fx.bodies['POST /presence/check-out']?.[0]).toMatchObject({ reason: 'PERSONAL', walkin_disposition: 'NOTIFY_AND_CANCEL' });
  });

  test('a reason is required before step 3 can move on', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    await openStep1(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  });

  test('NOTIFY_AND_CANCEL with guests: the confirm needs both checkboxes before submit', async ({ page }) => {
    const preview: PreviewView = { ...emptyPreview(), queues: [{ queue_id: 'q1', status: 'OPEN', counts: { registered: 0, waiting: 2, called: 0, skipped: 0, in_consultation: 0 }, guest_count: 2 }] };
    const fx = await mockDoctorDay(page, { presence: 'IN', preview });
    await openStep1(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('radio', { name: 'Personal', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('radio', { name: 'Cancel walk-ins with notice', exact: true }).click();

    const submit = page.getByRole('button', { name: 'Check out', exact: true });
    await expect(submit).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Confirm walk-in cancellation' }).click();
    await expect(submit).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Guests were told in person' }).click();
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText('You are checked out. No appointment was cancelled. Booked patients are not told automatically.')).toBeVisible();
    expect(fx.bodies['POST /presence/check-out']?.[0]).toEqual({
      clinic_location_id: 'loc1', reason: 'PERSONAL', walkin_disposition: 'NOTIFY_AND_CANCEL', guests_informed_in_person: true,
    });
    expect(await axeViolations(page)).toEqual([]);
  });

  test('a 422 for the guests checkbox keeps the flow and asks for the tick', async ({ page }) => {
    const preview: PreviewView = { ...emptyPreview(), queues: [{ queue_id: 'q1', status: 'OPEN', counts: { registered: 0, waiting: 1, called: 0, skipped: 0, in_consultation: 0 }, guest_count: 1 }] };
    const fx = await mockDoctorDay(page, { presence: 'IN', preview });
    failNext(fx, 'POST /presence/check-out', { status: 422, code: 'VALIDATION_FAILED', errors: { guests_informed_in_person: ['Required.'] } });
    await openStep1(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('radio', { name: 'Other', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('radio', { name: 'Cancel walk-ins with notice', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Confirm walk-in cancellation' }).click();
    await page.getByRole('checkbox', { name: 'Guests were told in person' }).click();
    await page.getByRole('button', { name: 'Check out', exact: true }).click();
    await expect(page.getByText('Tick "I told the guests in person" to confirm before cancelling.')).toBeVisible();
    await expect(page.getByText('Step 4 of 4: Walk-ins and confirm')).toBeVisible();
  });

  test('a 409 at POST (a consultation started meanwhile) returns to step 1 with a fresh preview', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    failNext(fx, 'POST /presence/check-out', { status: 409, code: 'ACTIVE_CONSULTATION', reason_code: 'in_progress' });
    await openStep1(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('radio', { name: 'End of shift', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Check out', exact: true }).click();
    await expect(page.getByText('Finish the consultation first.')).toBeVisible();
    await expect(page.getByText('Step 1 of 4: Check what is open')).toBeVisible();
    expect(count(fx, 'GET /presence/check-out/preview')).toBeGreaterThan(1);
  });

  test('a timed-out check-out already done (409 not_checked_in) shows "You are checked out"', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    failNext(fx, 'POST /presence/check-out', { status: 409, code: 'INVALID_STATE_TRANSITION', reason_code: 'not_checked_in' });
    await openStep1(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('radio', { name: 'End of shift', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Check out', exact: true }).click();
    await expect(page.getByText('You are checked out. The clinic day shows your current status and the counts.')).toBeVisible();
  });

  test('not checked in: the flow shows the empty state', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'NOT_CHECKED_IN' });
    await page.goto('/doctor/check-out');
    await expect(page.getByText('You are not checked in, so there is nothing to check out of.')).toBeVisible({ timeout: 45_000 });
  });

  test('offline: Next and Check out are disabled and the offline notice shows', async ({ page, context }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    await openStep1(page);
    await context.setOffline(true);
    await expect(page.getByText('You are offline. Check-out needs a connection.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    await context.setOffline(false);
  });

  test('a read failure on the preview shows the error state with a retry', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    fx.failAlways['GET /presence/check-out/preview'] = { status: 500, code: 'SERVER_ERROR', message: 'Server error.' };
    await page.goto('/doctor/check-out');
    await expect(page.getByRole('button', { name: /retry|try again/i })).toBeVisible({ timeout: 45_000 });
    expect(await axeViolations(page)).toEqual([]);
  });
});
