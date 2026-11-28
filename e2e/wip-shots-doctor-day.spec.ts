import { expect, test, type Page } from '@playwright/test';
import { mockDoctorDay, mixedQueue, emptyPreview, type PreviewView } from './doctor-fixtures';

/**
 * WIP screenshots of the doctor day (increment 5.9): presence, check-in, check-out and the walk-in queue, in the
 * running Expo web app with SYNTHETIC fixtures only (made-up names such as "Ana Reyes", example.test addresses, made-up ids).
 * Run from mobile/: WIP_SHOTS=1 pnpm exec playwright test wip-shots-doctor-day --project=desktop --project=mobile
 * Output: ../docs/wip-screenshots/phase-5/doctor-day/ (relative to mobile/, the Playwright working directory).
 */
const PHASE = 'phase-5';
const OUT_DIR = `../docs/wip-screenshots/${PHASE}/doctor-day`;

const blockedPreview: PreviewView = { ...emptyPreview(), blocking: [{ code: 'ACTIVE_CONSULTATION', reason_code: 'in_progress' }] };
const notifyPreview: PreviewView = {
  ...emptyPreview(),
  queues: [{ queue_id: 'q1', status: 'OPEN', counts: { registered: 0, waiting: 2, called: 0, skipped: 0, in_consultation: 0 }, guest_count: 1 }],
};

const shots = [
  { name: 'presence-in', path: '/doctor/presence', heading: 'Clinic day', presence: 'IN' as const },
  { name: 'presence-not-checked-in', path: '/doctor/presence', heading: 'Clinic day', presence: 'NOT_CHECKED_IN' as const },
  { name: 'presence-on-break', path: '/doctor/presence', heading: 'Clinic day', presence: 'ON_BREAK' as const },
  { name: 'presence-busy', path: '/doctor/presence', heading: 'Clinic day', presence: 'BUSY' as const },
  { name: 'check-in-picker', path: '/doctor/check-in', heading: 'Check in', presence: 'NOT_CHECKED_IN' as const },
  { name: 'check-out-blocked', path: '/doctor/check-out', heading: 'Check out', presence: 'BUSY' as const, preview: blockedPreview, step: 2 },
  { name: 'check-out-notify-guests', path: '/doctor/check-out', heading: 'Check out', presence: 'IN' as const, preview: notifyPreview, step: 4 },
  { name: 'queue-mixed', path: '/doctor/queue', heading: 'Walk-in queue', presence: 'IN' as const },
  { name: 'queue-paused', path: '/doctor/queue', heading: 'Walk-in queue', presence: 'IN' as const, paused: true },
  { name: 'queue-empty', path: '/doctor/queue', heading: 'Walk-in queue', presence: 'IN' as const, empty: true },
];

/**
 * fullPage does not capture RN Web content: the screen scrolls inside a ScrollView, not the document. So the viewport
 * is made as tall as the scroll content (header included) and the shot is taken at that height. Loops, since a taller
 * viewport can change the layout.
 */
async function growViewportToContent(page: Page) {
  for (let i = 0; i < 4; i++) {
    const overflow = await page.evaluate(() => {
      let worst = 0;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const overflowY = getComputedStyle(el).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          worst = Math.max(worst, el.scrollHeight - el.clientHeight);
        }
      }
      return worst;
    });
    if (overflow <= 1) return;
    const vp = page.viewportSize();
    if (!vp) return;
    await page.setViewportSize({ width: vp.width, height: vp.height + Math.ceil(overflow) });
    await page.waitForTimeout(150);
  }
}

/** Every screen is captured in light and dark mode (the app follows the system colour scheme). */
const THEMES = ['light', 'dark'] as const;

for (const s of shots) {
  for (const theme of THEMES) {
  test(`wip shot: doctor-day/${s.name}-${theme}`, async ({ page }, info) => {
    test.skip(!process.env.WIP_SHOTS, 'set WIP_SHOTS=1 to capture');
    test.skip(info.project.name === 'tablet', 'desktop + mobile only');
    const fx = await mockDoctorDay(page, {
      presence: s.presence,
      ...(s.preview ? { preview: s.preview } : {}),
      board: {
        clinic_location_id: 'loc1', local_date: '2026-11-28', restricted: false,
        queues: [s.paused ? { ...mixedQueue('PAUSED') } : s.empty ? { ...mixedQueue(), entries: [] } : mixedQueue()],
      },
    });
    void fx;
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(s.path);
    await expect(page.getByRole('heading', { name: s.heading, exact: true })).toBeVisible({ timeout: 45_000 });
    if (s.step) {
      // Walk the check-out steps to the requested one (2: blocks, 4: walk-ins and confirm).
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      if (s.step >= 3) {
        await expect(page.getByText('Step 2 of 4: Blocks')).toBeVisible();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('radio', { name: 'Personal', exact: true }).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('radio', { name: 'Cancel walk-ins with notice', exact: true }).click();
      }
    }
    await growViewportToContent(page);
    await page.screenshot({ path: `${OUT_DIR}/${s.name}-${theme}-${info.project.name}.png` });
  });
  }
}
