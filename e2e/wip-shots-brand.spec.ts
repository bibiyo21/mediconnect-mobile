import { expect, test } from '@playwright/test';
import { mockApi } from './helpers';

/**
 * WIP screenshots of the brand integration: welcome (logo) and home (feature
 * icons, SVG tab icons). Real running Expo web app, mocked API fixtures only.
 * Run: WIP_SHOTS=1 pnpm exec playwright test wip-shots-brand --project=desktop --project=mobile
 */
const shots = [
  { name: 'mobile-welcome', path: '/', heading: 'MediConnect', signedIn: false },
  { name: 'mobile-home', path: '/', heading: 'Coming soon to MediConnect', signedIn: true },
];

for (const s of shots) {
  test(`wip shot: brand/${s.name}`, async ({ page }, info) => {
    test.skip(!process.env.WIP_SHOTS, 'set WIP_SHOTS=1 to capture');
    test.skip(info.project.name === 'tablet', 'desktop + mobile only');
    await mockApi(page, { signedIn: s.signedIn });
    await page.goto(s.path);
    await expect(page.getByText(s.heading, { exact: true }).first()).toBeVisible({ timeout: 45_000 });
    // Every brand image has loaded and has a size (no empty frames).
    await expect.poll(() => page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: `${info.config.rootDir}/../../docs/wip-screenshots/phase-2/brand/${s.name}-${info.project.name}.png`, fullPage: true });
  });
}
