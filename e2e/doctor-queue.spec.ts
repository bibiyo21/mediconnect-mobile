import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { axeViolations, expectNoHorizontalScroll } from './helpers';
import { count, failNext, mockDoctorDay, mixedQueue, type Fixture } from './doctor-fixtures';

/*
 * Increment 5.9-M2: the doctor's own walk-in queue (call next, recall, skip, no-show, return, priority, the urgent
 * override, the consultation start, end, interrupt and resume), against mocked API fixtures (synthetic data only).
 * The realtime tests need a Reverb app key at bundle time: see the note above `realtime` below.
 */

async function openQueue(page: Page) {
  await page.goto('/doctor/queue');
  await expect(page.getByRole('heading', { name: 'Walk-in queue', exact: true })).toBeVisible({ timeout: 45_000 });
}

test.describe('walk-in queue (mocked API)', () => {
  test('a mixed queue shows the now, waiting and skipped sections with the server-offered actions and no axe violations', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    await openQueue(page);
    await expect(page.getByText('Your queue · open')).toBeVisible();
    await expect(page.getByText('Now', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Waiting', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Skipped', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Call A-102', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Call A-103', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Call next patient', exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('an estimate is shown as a range and labelled as an estimate; an HMO claim is shown as not verified', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    await openQueue(page);
    await expect(page.getByText('About 5 to 12 min · estimate, not a guarantee').first()).toBeVisible();
    // The not-arrived count is in the card summary; REGISTERED entries are not listed.
    await expect(page.getByText(/1 not arrived/)).toBeVisible();
    await expect(page.getByText(/not verified/).first()).toBeVisible();
  });

  test('CALLED entry offers start, recall, skip and no-show; a waiting entry offers only call and priority when first', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    await openQueue(page);
    for (const name of ['Start consultation with A-101', 'Recall A-101', 'Skip A-101', 'Mark A-101 as no-show']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    // A-102 is first in line (call and priority); A-103 is not first (priority only).
    await expect(page.getByRole('button', { name: 'Change priority for A-102', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Call A-103', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Change priority for A-103', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Put A-104 back in line', exact: true })).toBeVisible();
  });

  test('the priority dialog takes a level and a reason code only, with no free-text field', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    await openQueue(page);
    await page.getByRole('button', { name: 'Change priority for A-103', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Priority for A-103', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Move to front', exact: true }).click();
    await page.getByRole('radio', { name: 'Pregnant', exact: true }).click();
    await page.getByRole('button', { name: 'Save priority', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Priority for A-103', exact: true })).toHaveCount(0);
    expect(fx.bodies['POST /walk-ins/:id/priority']?.[0]).toEqual({ priority_level: 'URGENT', priority_reason_code: 'PREGNANT' });
  });

  test('empty board: no queue at this clinic shows the empty state', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'IN', board: { clinic_location_id: 'loc1', local_date: '2026-11-28', restricted: false, queues: [] } });
    await openQueue(page);
    await expect(page.getByText('You have no walk-in queue at this clinic today.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Call next patient', exact: true })).toHaveCount(0);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('a queue with no one in it shows its own empty state', async ({ page }) => {
    const queue = { ...mixedQueue(), entries: [] };
    await mockDoctorDay(page, { presence: 'IN', board: { clinic_location_id: 'loc1', local_date: '2026-11-28', restricted: false, queues: [queue] } });
    await openQueue(page);
    await expect(page.getByText('No one is in this queue today.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Call next patient', exact: true })).toBeDisabled();
  });

  test('not checked in: the queue shows the check-in empty state', async ({ page }) => {
    await mockDoctorDay(page, { presence: 'NOT_CHECKED_IN' });
    await openQueue(page);
    await expect(page.getByText('Check in at a clinic to see your walk-in queue.')).toBeVisible();
  });

  test('a paused queue says no new walk-ins can join and offers to open it; open then sends the open call', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN', board: { clinic_location_id: 'loc1', local_date: '2026-11-28', restricted: false, queues: [mixedQueue('PAUSED')] } });
    await openQueue(page);
    await expect(page.getByText('This queue is paused: no new walk-ins can join. You can still call patients already in it.')).toBeVisible();
    await page.getByRole('button', { name: 'Open for new walk-ins', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause new walk-ins', exact: true })).toBeVisible();
    expect(count(fx, 'POST /walk-ins/queues/:id/open')).toBe(1);
  });

  test('a protected window refusal shows the protected wording (APPOINTMENT_WINDOW_PROTECTED)', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    failNext(fx, 'POST /walk-ins/queues/:id/call-next', {
      status: 409, code: 'APPOINTMENT_WINDOW_PROTECTED', reason_code: 'protected',
      errors: { blocked_until: ['2026-11-28T03:00:00Z'] },
    });
    await openQueue(page);
    await page.getByRole('button', { name: 'Call next patient', exact: true }).click();
    await expect(page.getByText(/A booked patient's time is reserved until about .* Wait, or call this patient now with a reason\./)).toBeVisible();
  });

  test('an urgent patient called during a protected window needs the override confirm; the reason is sent as a code', async ({ page }) => {
    // A-102 is the first waiting entry and PRIORITY, so the call button is offered and may be overridden.
    const queue = mixedQueue();
    queue.entries = queue.entries.map((e) => (e.id === 'e2' ? { ...e, priority_level: 'PRIORITY', priority_reason_code: 'DOCTOR_REQUEST' } : e));
    const fx = await mockDoctorDay(page, { presence: 'IN', board: { clinic_location_id: 'loc1', local_date: '2026-11-28', restricted: false, queues: [queue] } });
    const protectedRefusal = { status: 409, code: 'APPOINTMENT_WINDOW_PROTECTED', reason_code: 'protected', errors: { blocked_until: ['2026-11-28T03:00:00Z'] } };
    failNext(fx, 'POST /walk-ins/:id/call', protectedRefusal);
    failNext(fx, 'POST /walk-ins/:id/call', protectedRefusal);
    await openQueue(page);
    await page.getByRole('button', { name: 'Call A-102', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Call A-102 now', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Do not call', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Call A-102 now', exact: true })).toHaveCount(0);

    // The second refusal opens the confirm again; confirming sends the override with the reason as a code.
    await page.getByRole('button', { name: 'Call A-102', exact: true }).click();
    // No reason is pre-selected: the doctor picks one before the override is possible.
    await expect(page.getByRole('button', { name: 'Call A-102 now', exact: true })).toBeDisabled();
    await page.getByRole('radio', { name: 'Doctor requested', exact: true }).click();
    await page.getByRole('button', { name: 'Call A-102 now', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Call A-102 now', exact: true })).toHaveCount(0);
    expect(fx.bodies['POST /walk-ins/:id/call']?.at(-1)).toEqual({ override_reason_code: 'DOCTOR_REQUEST' });
  });

  test('a call refused as already calling (DOCTOR_ALREADY_CALLING previous_day) shows the clinic-desk wording', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    failNext(fx, 'POST /walk-ins/queues/:id/call-next', { status: 409, code: 'DOCTOR_ALREADY_CALLING', reason_code: 'previous_day' });
    await openQueue(page);
    await page.getByRole('button', { name: 'Call next patient', exact: true }).click();
    await expect(page.getByText('A patient from an earlier day is still called. The clinic desk has to clear that entry first. If there is no desk, contact support.', { exact: true })).toBeVisible();
  });

  test('a stale list (409 NOT_NEXT_IN_ORDER) says the list was refreshed and reads the board again', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    failNext(fx, 'POST /walk-ins/:id/call', { status: 409, code: 'NOT_NEXT_IN_ORDER' });
    await openQueue(page);
    const before = count(fx, 'GET /walk-ins/queue');
    await page.getByRole('button', { name: 'Call A-102', exact: true }).click();
    await expect(page.getByText('The next patient in order is someone else. The list has been refreshed.')).toBeVisible();
    expect(count(fx, 'GET /walk-ins/queue')).toBeGreaterThan(before);
  });

  test('a patient already called blocks a second call (ENTRY_ALREADY_CALLED)', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    failNext(fx, 'POST /walk-ins/queues/:id/call-next', { status: 409, code: 'ENTRY_ALREADY_CALLED' });
    await openQueue(page);
    await page.getByRole('button', { name: 'Call next patient', exact: true }).click();
    await expect(page.getByText('Another patient in this queue is already called. Start, skip or mark no-show first.')).toBeVisible();
  });

  test('start, then end the consultation: the actions change with the consultation status', async ({ page }) => {
    const fx = await mockDoctorDay(page, {
      presence: 'IN',
      board: { clinic_location_id: 'loc1', local_date: '2026-11-28', restricted: false, queues: [{ ...mixedQueue(), entries: mixedQueue().entries.map((e) => (e.id === 'e1' ? { ...e, consultation_id: 'cons1' } : e)) }] },
    });
    fx.consultation.status = 'IN_PROGRESS';
    await openQueue(page);
    await page.getByRole('button', { name: 'Start consultation with A-101', exact: true }).click();
    await expect(page.getByRole('button', { name: 'End consultation with A-101', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Interrupt consultation with A-101', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'End consultation with A-101', exact: true }).click();
    await expect(page.getByRole('button', { name: 'End consultation with A-101', exact: true })).toHaveCount(0);
    expect(count(fx, 'POST /consultations/:id/start')).toBe(1);
    expect(count(fx, 'POST /consultations/:id/end')).toBe(1);
  });

  test('an interrupted consultation shows the resume note and offers resume', async ({ page }) => {
    await mockDoctorDay(page, {
      presence: 'IN',
      consultation: { id: 'cons1', status: 'INTERRUPTED', walkin_queue_entry_id: 'e1' },
      board: { clinic_location_id: 'loc1', local_date: '2026-11-28', restricted: false, queues: [{ ...mixedQueue(), entries: mixedQueue().entries.map((e) => (e.id === 'e1' ? { ...e, status: 'IN_CONSULTATION', consultation_id: 'cons1' } : e)) }] },
    });
    await openQueue(page);
    await expect(page.getByText('Interrupted: resume or end this consultation. Check-out waits until it ends.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume consultation with A-101', exact: true })).toBeVisible();
  });

  test('loading and error states: a failed board read shows the error with a retry', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    fx.failAlways['GET /walk-ins/queue'] = { status: 500, code: 'SERVER_ERROR', message: 'Server error.' };
    await page.goto('/doctor/queue');
    await expect(page.getByRole('button', { name: /retry|try again/i })).toBeVisible({ timeout: 45_000 });
    expect(await axeViolations(page)).toEqual([]);
  });

  test('offline: call actions are disabled and the offline notice shows', async ({ page, context }) => {
    await mockDoctorDay(page, { presence: 'IN' });
    await openQueue(page);
    await context.setOffline(true);
    await expect(page.getByText('You are offline. Queue actions are paused until you reconnect.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Call A-102', exact: true })).toBeDisabled();
    await context.setOffline(false);
  });
});

/*
 * Realtime, via page.routeWebSocket (the Pusher protocol, faked). The Expo web bundle reads the Reverb key when the dev
 * server starts, so these run only when the server is started with the key set, for example:
 *   EXPO_PUBLIC_REVERB_APP_KEY=mediconnect-e2e-key EXPO_PUBLIC_REVERB_HOST=reverb.example.test EXPO_PUBLIC_REVERB_PORT=8080 \
 *   EXPO_PUBLIC_REVERB_SCHEME=http pnpm e2e -- e2e/doctor-queue.spec.ts
 * Without the key the app runs with no live updates ("Updates paused") and these tests are skipped.
 */
const REALTIME_KEY = process.env.EXPO_PUBLIC_REVERB_APP_KEY ?? '';

/**
 * Accepts the Pusher connection and confirms every subscription. `sockets` lists every connection the page opened;
 * `refuse` makes new connections close at once, so the page stays disconnected until a test allows them again.
 */
async function fakeReverb(page: Page): Promise<{ sockets: WebSocketRoute[]; setRefuse: (refuse: boolean) => void }> {
  const sockets: WebSocketRoute[] = [];
  let refuse = false;
  await page.routeWebSocket(new RegExp(`/app/${REALTIME_KEY}`), (ws) => {
    if (refuse) {
      ws.close({ code: 1011, reason: 'test: refused' });
      return;
    }
    sockets.push(ws);
    ws.send(JSON.stringify({ event: 'pusher:connection_established', data: JSON.stringify({ socket_id: `1.${sockets.length}`, activity_timeout: 120 }) }));
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw)) as { event: string; data?: { channel?: string } };
      if (msg.event === 'pusher:subscribe' && msg.data?.channel) {
        ws.send(JSON.stringify({
          event: 'pusher_internal:subscription_succeeded',
          channel: msg.data.channel,
          data: JSON.stringify({ presence: { count: 1, ids: ['1'], hash: { '1': {} } } }),
        }));
      }
    });
  });
  return { sockets, setRefuse: (next) => (refuse = next) };
}

function queueHint(queueVersion: number) {
  return JSON.stringify({
    event: 'WalkInQueueUpdated',
    channel: 'presence-doctor.doc1',
    data: JSON.stringify({ queue_id: 'q1', clinic_location_id: 'loc1', doctor_profile_id: 'doc1', status: 'OPEN', waiting_count: 2, queue_version: queueVersion, occurred_at: '2026-11-28T02:00:00Z' }),
  });
}

test.describe('realtime queue hints', () => {
  test.skip(!REALTIME_KEY, 'set EXPO_PUBLIC_REVERB_APP_KEY when starting the dev server (see the note above)');

  test('a newer queue_version refetches the board; an older one does not', async ({ page }) => {
    const fx: Fixture = await mockDoctorDay(page, { presence: 'IN' });
    const { sockets } = await fakeReverb(page);
    await openQueue(page);
    await expect(page.getByText('Updates paused. This list may be out of date. Refresh before you call.')).toHaveCount(0, { timeout: 45_000 });
    expect(sockets.length).toBeGreaterThan(0);

    const before = count(fx, 'GET /walk-ins/queue');
    sockets[0].send(queueHint(5));
    await expect.poll(() => count(fx, 'GET /walk-ins/queue')).toBeGreaterThan(before);

    const settled = count(fx, 'GET /walk-ins/queue');
    sockets[0].send(queueHint(4));
    await page.waitForTimeout(2000);
    expect(count(fx, 'GET /walk-ins/queue')).toBe(settled);
  });

  test('a dropped socket shows "Updates paused" and refetches when it reconnects', async ({ page }) => {
    const fx = await mockDoctorDay(page, { presence: 'IN' });
    const { sockets, setRefuse } = await fakeReverb(page);
    await openQueue(page);
    await expect(page.getByText('Updates paused. This list may be out of date. Refresh before you call.')).toHaveCount(0, { timeout: 45_000 });

    // Refuse the reconnect so the disconnected state is held long enough to see.
    setRefuse(true);
    sockets[0].close({ code: 1006, reason: 'test drop' });
    await expect(page.getByText('Updates paused. This list may be out of date. Refresh before you call.')).toBeVisible({ timeout: 15_000 });

    const before = count(fx, 'GET /walk-ins/queue');
    setRefuse(false);
    await expect.poll(() => sockets.length, { timeout: 45_000 }).toBeGreaterThan(1);
    await expect(page.getByText('Updates paused. This list may be out of date. Refresh before you call.')).toHaveCount(0, { timeout: 45_000 });
    await expect.poll(() => count(fx, 'GET /walk-ins/queue')).toBeGreaterThan(before);
  });
});
