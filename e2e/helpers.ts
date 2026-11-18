import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.2 AA scan; returns readable violation ids. */
export async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const account = {
  id: '01a1ec01-0000-7000-8000-000000000001',
  email: 'patient@example.test',
  mobile_masked: null,
  email_verified: true,
  mobile_verified: false,
  status: 'ACTIVE',
  locale: 'en',
  roles: ['PATIENT'],
  profile: { first_name: 'Ana', middle_name: null, last_name: 'Reyes' },
};

export const patientProfile = {
  id: '01a1ec01-0000-7000-8000-0000000000p1',
  first_name: 'Ana',
  middle_name: null,
  last_name: 'Reyes',
  date_of_birth: '1990-05-17',
  sex: null,
  preferred_language: 'en',
  emergency_contact: null,
  address: null,
};

const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, meta: {}, message: null }) });

/**
 * The web build uses cookie sessions: the app asks GET /auth/me at start-up.
 * These mocks stand in for the backend so the suite runs without it.
 */
export async function mockApi(page: Page, { signedIn }: { signedIn: boolean }): Promise<void> {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/auth/me', (route) =>
    signedIn ? route.fulfill(ok(account)) : route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Unauthenticated.', errors: {}, code: 'UNAUTHENTICATED' }) }),
  );
  await page.route('**/api/v1/auth/devices', (route) =>
    route.fulfill(ok([{ id: 'd1', platform: 'WEB', device_name: null, app_version: null, last_seen_at: '2026-11-18T00:15:00Z', created_at: '2026-11-18T00:14:00Z', current: true }])),
  );
  await page.route('**/api/v1/patients/me', (route) => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill(ok({ ...patientProfile, ...(route.request().postDataJSON() as object) }));
    }
    return route.fulfill(ok(patientProfile));
  });
  const dependents = [{ id: '01a1ec01-0000-7000-8000-0000000000d1', first_name: 'Lia', middle_name: null, last_name: 'Reyes', date_of_birth: '2018-03-10', sex: 'FEMALE', relationship: 'CHILD', authorized_at: '2026-11-18T00:00:00Z' }];
  await page.route('**/api/v1/patients/me/dependents', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...body, id: '01a1ec01-0000-7000-8000-0000000000d2', authorized_at: '2026-11-18T01:00:00Z' }, meta: {}, message: null }) });
    }
    return route.fulfill(ok(dependents));
  });
  await page.route('**/api/v1/patients/me/dependents/*', (route) => {
    const method = route.request().method();
    if (method === 'DELETE') return route.fulfill(ok({}));
    if (method === 'PATCH') return route.fulfill(ok({ ...dependents[0], ...(route.request().postDataJSON() as object) }));
    return route.fulfill(ok(dependents[0]));
  });
  await page.route('**/api/v1/auth/account/deletion-request', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ success: true, data: { deletion_scheduled_for: '2026-12-18T03:00:00Z' }, meta: {}, message: 'Your account is scheduled for deletion. Sign in before then to keep it.' }) }),
  );
  await page.route('**/api/v1/auth/contact/otp', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ success: true, data: { challenge_id: '01a1ec01-0000-7000-8000-0000000000c2', channel: 'SMS', destination_masked: '+63•••••••4567', expires_at: '2026-11-18T00:30:00Z' }, meta: {}, message: 'If the address can receive a code, one has been sent.' }) }),
  );
  await page.route('**/api/v1/auth/contact', (route) => route.fulfill(ok({ ...account, mobile_masked: '+63•••••••4567', mobile_verified: true })));
  await page.route('**/api/v1/auth/otp/verify', (route) => route.fulfill(ok({ verification_token: 'v'.repeat(64), expires_in_minutes: 10 })));
  await page.route('**/api/v1/auth/reset-password', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {}, meta: {}, message: 'Your password was changed.' }) }),
  );
  await page.route('**/api/v1/auth/forgot-password', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ success: true, data: { challenge_id: '01a1ec01-0000-7000-8000-0000000000c1', channel: 'EMAIL', destination_masked: 'p•••@example.test', expires_at: '2026-11-18T00:30:00Z' }, meta: {}, message: 'If the address can receive a code, one has been sent.' }) }),
  );
}
