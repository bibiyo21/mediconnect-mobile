import { expect, test } from '@playwright/test';
import { mockApi } from './helpers';

/**
 * WIP screenshots of the doctor onboarding screens (real running Expo web app,
 * mocked API fixtures only). Run: WIP_SHOTS=1 pnpm exec playwright test wip-shots-doctor --project=desktop --project=mobile
 */
const shots = [
  { name: 'doctor-start', path: '/doctor/start', heading: 'Register as a doctor', doctor: null },
  { name: 'doctor-status', path: '/doctor', heading: 'Dr. Ana Reyes', doctor: 'REGISTERED' as const },
  { name: 'doctor-rejected', path: '/doctor', heading: 'Dr. Ana Reyes', doctor: 'REJECTED' as const },
  { name: 'doctor-edit', path: '/doctor/edit', heading: 'Edit doctor profile', doctor: 'REGISTERED' as const },
  { name: 'doctor-clinics', path: '/doctor/clinics', heading: 'Your clinics', doctor: 'VERIFIED' as const },
  { name: 'doctor-services', path: '/doctor/services', heading: 'Services and fees', doctor: 'VERIFIED' as const },
  { name: 'directory-list', path: '/directory', heading: 'Doctors', doctor: null },
  { name: 'directory-doctor', path: '/directory/doctor/01a1ed01-0000-7000-8000-00000000d001', heading: 'Dr. Ana Reyes', doctor: null },
  { name: 'directory-clinic', path: '/directory/clinic/01a1ec01-0000-7000-8000-00000000c001', heading: 'Santos Family Clinic', doctor: null },
];

for (const s of shots) {
  test(`wip shot: doctors/${s.name}`, async ({ page }, info) => {
    test.skip(!process.env.WIP_SHOTS, 'set WIP_SHOTS=1 to capture');
    test.skip(info.project.name === 'tablet', 'desktop + mobile only');
    await mockApi(page, { signedIn: true, doctor: s.doctor });
    await page.goto(s.path);
    await expect(page.getByRole('heading', { name: s.heading, exact: true })).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: `${info.config.rootDir}/../../docs/wip-screenshots/phase-2/doctors/${s.name}-${info.project.name}.png`, fullPage: true });
  });
}
