import { expect, test } from '@playwright/test';
import { mockApi } from './helpers';

/**
 * WIP screenshots of doctor search (real running Expo web app, mocked API fixtures only).
 * Run: WIP_SHOTS=1 pnpm exec playwright test wip-shots-search --project=desktop --project=mobile
 */
const shots = [
  { name: 'search-results', path: '/search', text: '1 doctor found' },
  { name: 'search-suggestions', path: '/search?q=neo', text: 'Specialties' },
  { name: 'search-empty', path: '/search?q=nobody', text: 'No doctors match. Try a different word, or remove a filter.' },
  { name: 'search-degraded', path: '/search?q=slow', text: 'Search is running in a simpler mode', exact: false },
  { name: 'home-search', path: '/', text: 'Find a doctor' },
];

for (const s of shots) {
  test(`wip shot: search/${s.name}`, async ({ page }, info) => {
    test.skip(!process.env.WIP_SHOTS, 'set WIP_SHOTS=1 to capture');
    test.skip(info.project.name === 'tablet', 'desktop + mobile only');
    await mockApi(page, { signedIn: true });
    await page.goto(s.path);
    await expect(page.getByText(s.text, { exact: s.exact ?? true }).first()).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: `${info.config.rootDir}/../../docs/wip-screenshots/phase-3/search/mobile-${s.name}-${info.project.name}.png`, fullPage: true });
  });
}

// Phase 4 (4.10): next open times in results and the open-times card on a profile.
const availabilityShots = [
  { name: 'search-next-open', path: '/search', text: '1 doctor found' },
  { name: 'doctor-open-times', path: '/directory/doctor/01a1ed01-0000-7000-8000-00000000d001', text: 'Open times' },
];

for (const s of availabilityShots) {
  test(`wip shot: availability/${s.name}`, async ({ page }, info) => {
    test.skip(!process.env.WIP_SHOTS, 'set WIP_SHOTS=1 to capture');
    test.skip(info.project.name === 'tablet', 'desktop + mobile only');
    await mockApi(page, { signedIn: true });
    await page.goto(s.path);
    await expect(page.getByText(s.text, { exact: true }).first()).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: `${info.config.rootDir}/../../docs/wip-screenshots/phase-4/availability/mobile-${s.name}-${info.project.name}.png`, fullPage: true });
  });
}
