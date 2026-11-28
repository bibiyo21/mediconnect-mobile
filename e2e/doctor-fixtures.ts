import type { Page, Route } from '@playwright/test';
import { mockApi } from './helpers';

/*
 * Increment 5.9: doctor presence, check-in, check-out and walk-in queue fixtures (test data only).
 * Every name, address and id here is synthetic. The fixture is a small state machine: writes change
 * the state the GETs return, and `fail()` queues a refusal for the next matching request.
 */

export const DOCTOR_ID = 'doc1';
export const LOC_MAKATI = 'loc1';
export const LOC_QC = 'loc2';
export const LOC_RMC = 'loc3';

const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, meta: {}, message: null }) });

export interface ApiFailure {
  status: number;
  code: string;
  reason_code?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

export type PresenceKey = 'NOT_CHECKED_IN' | 'IN' | 'ON_BREAK' | 'AWAY' | 'BUSY' | 'OUT';

export interface PresenceView {
  status: string;
  effective_status: string;
  session_id: string | null;
  clinic_location_id: string | null;
  checked_in_at: string | null;
  break_expected_end_at: string | null;
  version: number | null;
}

export interface DayLocationView {
  clinic_location_id: string;
  location_name: string;
  local_date: string;
  timezone: string;
  shifts: { starts_at: string; ends_at: string; service_mode: 'APPOINTMENT' | 'WALK_IN' | 'BOTH' }[];
  scheduled_breaks: { id: string; starts_at: string; ends_at: string }[];
  check_in: { allowed: boolean; reason_code?: string; opens_at?: string };
}

export interface PreviewView {
  session: { id: string; status: string; version: number } | null;
  blocking: { code: string; reason_code: string }[];
  active_consultation: { id: string | null; status: string } | null;
  queues: { queue_id: string; status: string; counts: Record<string, number>; guest_count: number }[];
  called_entry_ids: string[] | null;
  live_entry_ids: string[] | null;
  appointments: { count: number; items: { id: string; starts_at: string }[] };
}

export interface EntryView {
  id: string;
  label: string;
  queue_number: number;
  status: string;
  queue_id: string;
  priority_level: string;
  priority_reason_code: string | null;
  recall_count: number;
  consultation_id: string | null;
  hmo_claim: { label: string } | null;
  estimate: { min_minutes: number | null; max_minutes: number | null; wait_status: string } | null;
}

export interface QueueView {
  id: string;
  status: 'OPEN' | 'PAUSED' | 'CLOSED';
  doctor_profile_id: string;
  doctor_name: string;
  live_count: number;
  entries: EntryView[];
}

export interface Fixture {
  presence: PresenceKey;
  presenceVersion: number;
  day: { local_date: string; timezone: string; locations: DayLocationView[] };
  preview: PreviewView;
  board: { clinic_location_id: string; local_date: string; restricted: boolean; queues: QueueView[] };
  consultation: { id: string; status: 'IN_PROGRESS' | 'INTERRUPTED' | 'ENDED'; walkin_queue_entry_id: string | null };
  /** Queued refusals keyed by route name, e.g. 'POST /presence/check-in'. Each applies to the next matching request only. */
  failNext: Record<string, ApiFailure[]>;
  /** Sticky refusals for a route name, applied to every matching request. */
  failAlways: Record<string, ApiFailure>;
  /** Requests seen, as 'METHOD route-name'. */
  calls: string[];
  /** Request bodies for writes, keyed by route name. */
  bodies: Record<string, unknown[]>;
}

const MAKATI_SHIFT = { starts_at: '2026-11-28T01:00:00Z', ends_at: '2026-11-28T04:00:00Z', service_mode: 'BOTH' as const };

export function presenceView(key: PresenceKey, version = 4): PresenceView {
  const base = { session_id: 'sess1', clinic_location_id: LOC_MAKATI, checked_in_at: '2026-11-28T01:05:00Z', break_expected_end_at: null, version };
  switch (key) {
    case 'NOT_CHECKED_IN':
      return { status: 'NOT_CHECKED_IN', effective_status: 'NOT_CHECKED_IN', session_id: null, clinic_location_id: null, checked_in_at: null, break_expected_end_at: null, version: null };
    case 'IN':
      return { ...base, status: 'IN', effective_status: 'IN' };
    case 'BUSY':
      return { ...base, status: 'IN', effective_status: 'BUSY' };
    case 'ON_BREAK':
      return { ...base, status: 'ON_BREAK', effective_status: 'ON_BREAK', break_expected_end_at: '2026-11-28T03:00:00Z' };
    case 'AWAY':
      return { ...base, status: 'TEMPORARILY_UNAVAILABLE', effective_status: 'TEMPORARILY_UNAVAILABLE' };
    case 'OUT':
      return { status: 'OUT', effective_status: 'OUT', session_id: null, clinic_location_id: null, checked_in_at: null, break_expected_end_at: null, version };
  }
}

export function dayFixture(): Fixture['day'] {
  return {
    local_date: '2026-11-28',
    timezone: 'Asia/Manila',
    locations: [
      {
        clinic_location_id: LOC_MAKATI, location_name: 'Makati branch', local_date: '2026-11-28', timezone: 'Asia/Manila',
        shifts: [MAKATI_SHIFT], scheduled_breaks: [{ id: 'brk1', starts_at: '2026-11-28T03:00:00Z', ends_at: '2026-11-28T03:15:00Z' }],
        check_in: { allowed: true },
      },
      {
        clinic_location_id: LOC_QC, location_name: 'Quezon City branch', local_date: '2026-11-28', timezone: 'Asia/Manila',
        shifts: [{ starts_at: '2026-11-28T05:00:00Z', ends_at: '2026-11-28T08:00:00Z', service_mode: 'WALK_IN' }], scheduled_breaks: [],
        check_in: { allowed: false, reason_code: 'outside_hours', opens_at: '2026-11-28T05:00:00Z' },
      },
    ],
  };
}

export function entry(overrides: Partial<EntryView> & { id: string; label: string; status: string }): EntryView {
  return {
    queue_number: 1, queue_id: 'q1', priority_level: 'NORMAL', priority_reason_code: null, recall_count: 0, consultation_id: null,
    hmo_claim: null, estimate: { min_minutes: 5, max_minutes: 12, wait_status: 'ESTIMATED' }, ...overrides,
  };
}

/** A mixed queue: one called (with a consultation to start), a first waiting, a waiting priority, a skipped and a not-arrived entry. */
export function mixedQueue(status: QueueView['status'] = 'OPEN'): QueueView {
  return {
    id: 'q1', status, doctor_profile_id: DOCTOR_ID, doctor_name: 'Dr. Ana Reyes', live_count: 4,
    entries: [
      entry({ id: 'e1', label: 'A-101', queue_number: 1, status: 'CALLED', consultation_id: 'cons1' }),
      entry({ id: 'e2', label: 'A-102', queue_number: 2, status: 'WAITING', hmo_claim: { label: 'HMO: not verified' } }),
      entry({ id: 'e3', label: 'A-103', queue_number: 3, status: 'WAITING', priority_level: 'PRIORITY', priority_reason_code: 'SENIOR_PWD' }),
      entry({ id: 'e4', label: 'A-104', queue_number: 4, status: 'SKIPPED' }),
      entry({ id: 'e5', label: 'A-105', queue_number: 5, status: 'REGISTERED', estimate: { min_minutes: null, max_minutes: null, wait_status: 'NOT_AVAILABLE_YET' } }),
    ],
  };
}

export function emptyPreview(): PreviewView {
  return {
    session: { id: 'sess1', status: 'OPEN', version: 4 }, blocking: [], active_consultation: null,
    queues: [{ queue_id: 'q1', status: 'OPEN', counts: { registered: 1, waiting: 2, called: 0, skipped: 1, in_consultation: 0 }, guest_count: 0 }],
    called_entry_ids: [], live_entry_ids: ['e2', 'e3'], appointments: { count: 3, items: [{ id: 'ap1', starts_at: '2026-11-28T02:00:00Z' }] },
  };
}

export function defaultFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    presence: 'IN',
    presenceVersion: 4,
    day: dayFixture(),
    preview: emptyPreview(),
    board: { clinic_location_id: LOC_MAKATI, local_date: '2026-11-28', restricted: false, queues: [mixedQueue()] },
    consultation: { id: 'cons1', status: 'IN_PROGRESS', walkin_queue_entry_id: 'e1' },
    failNext: {},
    failAlways: {},
    calls: [],
    bodies: {},
    ...overrides,
  };
}

const ACTIVE_DOCTOR = {
  id: DOCTOR_ID, display_name: 'Dr. Ana Reyes', professional_title: 'MD', biography: null, prc_license_number_masked: '•••567',
  license_verification_status: 'VERIFIED', onboarding_status: 'ACTIVE', licence_locked: true, medical_school: null, years_experience: 8, gender: null,
  languages: ['en'], specialties: [], specialty_review_pending: false, education: [], experience: [], profile_completeness: 80, verification_history: [],
};

/** The route table. `name` is what failures and bodies are keyed by. */
interface Route_ {
  name: string;
  method: 'GET' | 'POST';
  path: RegExp;
  run: (fx: Fixture, m: RegExpMatchArray, body: Record<string, unknown>) => { data: unknown } | { error: ApiFailure };
}

function setPresence(fx: Fixture, key: PresenceKey) {
  fx.presence = key;
  fx.presenceVersion += 1;
  return { data: presenceView(key, fx.presenceVersion) };
}

function setEntry(fx: Fixture, id: string, patch: Partial<EntryView>) {
  for (const q of fx.board.queues) q.entries = q.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
  const found = fx.board.queues.flatMap((q) => q.entries).find((e) => e.id === id);
  return { data: found };
}

const ROUTES: Route_[] = [
  { name: 'GET /presence/me', method: 'GET', path: /^\/presence\/me$/, run: (fx) => ({ data: presenceView(fx.presence, fx.presenceVersion) }) },
  { name: 'GET /presence/me/day', method: 'GET', path: /^\/presence\/me\/day$/, run: (fx) => ({ data: fx.day }) },
  { name: 'GET /presence/check-out/preview', method: 'GET', path: /^\/presence\/check-out\/preview$/, run: (fx) => ({ data: fx.preview }) },
  { name: 'POST /presence/check-in', method: 'POST', path: /^\/presence\/check-in$/, run: (fx) => setPresence(fx, 'IN') },
  { name: 'POST /presence/break/start', method: 'POST', path: /^\/presence\/break\/start$/, run: (fx) => setPresence(fx, 'ON_BREAK') },
  { name: 'POST /presence/break/end', method: 'POST', path: /^\/presence\/break\/end$/, run: (fx) => setPresence(fx, 'IN') },
  { name: 'POST /presence/unavailable', method: 'POST', path: /^\/presence\/unavailable$/, run: (fx) => setPresence(fx, 'AWAY') },
  { name: 'POST /presence/available', method: 'POST', path: /^\/presence\/available$/, run: (fx) => setPresence(fx, 'IN') },
  {
    name: 'POST /presence/check-out', method: 'POST', path: /^\/presence\/check-out$/,
    run: (fx) => {
      fx.presence = 'OUT';
      fx.presenceVersion += 1;
      return {
        data: {
          status: 'OUT', effective_status: 'OUT', session_id: 'sess1', clinic_location_id: LOC_MAKATI, checked_in_at: '2026-11-28T01:05:00Z',
          break_expected_end_at: null, version: fx.presenceVersion,
          result: { queues_paused: 1, entries_held: 2, entries_cancelled: 0, appointments_flagged: 3, tasks_created: 0 },
        },
      };
    },
  },
  { name: 'GET /walk-ins/queue', method: 'GET', path: /^\/walk-ins\/queue$/, run: (fx) => ({ data: fx.board }) },
  {
    name: 'POST /walk-ins/queues/:id/call-next', method: 'POST', path: /^\/walk-ins\/queues\/[^/]+\/call-next$/,
    run: (fx) => {
      const head = fx.board.queues[0]?.entries.find((e) => e.status === 'WAITING');
      return head ? setEntry(fx, head.id, { status: 'CALLED' }) : { error: { status: 409, code: 'QUEUE_EMPTY' } };
    },
  },
  { name: 'POST /walk-ins/queues/:id/pause', method: 'POST', path: /^\/walk-ins\/queues\/[^/]+\/pause$/, run: (fx) => { fx.board.queues[0].status = 'PAUSED'; return { data: {} }; } },
  { name: 'POST /walk-ins/queues/:id/open', method: 'POST', path: /^\/walk-ins\/queues\/[^/]+\/open$/, run: (fx) => { fx.board.queues[0].status = 'OPEN'; return { data: {} }; } },
  { name: 'POST /walk-ins/:id/call', method: 'POST', path: /^\/walk-ins\/([^/]+)\/call$/, run: (fx, m) => setEntry(fx, m[1], { status: 'CALLED' }) },
  { name: 'POST /walk-ins/:id/recall', method: 'POST', path: /^\/walk-ins\/([^/]+)\/recall$/, run: (fx, m) => setEntry(fx, m[1], { status: 'CALLED' }) },
  { name: 'POST /walk-ins/:id/skip', method: 'POST', path: /^\/walk-ins\/([^/]+)\/skip$/, run: (fx, m) => setEntry(fx, m[1], { status: 'SKIPPED' }) },
  { name: 'POST /walk-ins/:id/no-show', method: 'POST', path: /^\/walk-ins\/([^/]+)\/no-show$/, run: (fx, m) => setEntry(fx, m[1], { status: 'NO_SHOW' }) },
  { name: 'POST /walk-ins/:id/return', method: 'POST', path: /^\/walk-ins\/([^/]+)\/return$/, run: (fx, m) => setEntry(fx, m[1], { status: 'WAITING' }) },
  { name: 'POST /walk-ins/:id/priority', method: 'POST', path: /^\/walk-ins\/([^/]+)\/priority$/, run: (fx, m) => setEntry(fx, m[1], { status: 'WAITING' }) },
  {
    name: 'POST /consultations/:id/start', method: 'POST', path: /^\/consultations\/([^/]+)\/start$/,
    run: (fx) => { fx.consultation.status = 'IN_PROGRESS'; setEntry(fx, 'e1', { status: 'IN_CONSULTATION' }); return { data: fx.consultation }; },
  },
  {
    name: 'POST /consultations/:id/end', method: 'POST', path: /^\/consultations\/([^/]+)\/end$/,
    run: (fx) => {
      fx.consultation.status = 'ENDED';
      setEntry(fx, 'e1', { status: 'COMPLETED' });
      return { data: fx.consultation };
    },
  },
  { name: 'POST /consultations/:id/interrupt', method: 'POST', path: /^\/consultations\/([^/]+)\/interrupt$/, run: (fx) => { fx.consultation.status = 'INTERRUPTED'; return { data: fx.consultation }; } },
  { name: 'POST /consultations/:id/resume', method: 'POST', path: /^\/consultations\/([^/]+)\/resume$/, run: (fx) => { fx.consultation.status = 'IN_PROGRESS'; return { data: fx.consultation }; } },
  { name: 'GET /consultations/:id', method: 'GET', path: /^\/consultations\/([^/]+)$/, run: (fx) => ({ data: fx.consultation }) },
];

export function routeName(method: string, path: string): { name: string; route: Route_; match: RegExpMatchArray } | null {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const match = path.match(route.path);
    if (match) return { name: route.name, route, match };
  }
  return null;
}

function errorBody(e: ApiFailure) {
  return JSON.stringify({ success: false, message: e.message ?? 'Refused.', errors: e.errors ?? {}, code: e.code, reason_code: e.reason_code ?? null });
}

/**
 * Mocks the doctor day on top of the shared mocks (signed in, VERIFIED doctor, ACTIVE profile). Returns the
 * fixture so a test can read the recorded calls and queue refusals. Routes added here win over mockApi's.
 */
export async function mockDoctorDay(page: Page, overrides: Partial<Fixture> = {}): Promise<Fixture> {
  await mockApi(page, { signedIn: true, doctor: 'VERIFIED' });
  const fx = defaultFixture(overrides);
  await page.route('**/api/v1/doctors/me', (route) => route.fulfill(ok(ACTIVE_DOCTOR)));
  await page.route('**/api/v1/broadcasting/auth', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ auth: 'mediconnect-e2e-key:0000', channel_data: JSON.stringify({ user_id: '1', user_info: {} }) }) }),
  );
  await page.route(/\/api\/v1\/(presence|walk-ins|consultations)(\/|$)/, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const found = routeName(req.method(), path);
    if (!found) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Not found.', errors: {}, code: 'NOT_FOUND' }) });
    fx.calls.push(found.name);
    const body = req.method() === 'POST' ? ((req.postDataJSON() ?? {}) as Record<string, unknown>) : {};
    if (req.method() === 'POST') (fx.bodies[found.name] ??= []).push(body);

    const queued = fx.failNext[found.name]?.shift();
    const sticky = fx.failAlways[found.name];
    const failure = queued ?? sticky;
    if (failure) {
      return route.fulfill({ status: failure.status, contentType: 'application/json', body: errorBody(failure) });
    }
    const result = found.route.run(fx, found.match, body);
    if ('error' in result) {
      return route.fulfill({ status: result.error.status, contentType: 'application/json', body: errorBody(result.error) });
    }
    return route.fulfill(ok(result.data));
  });
  return fx;
}

/** Queue one refusal for the next request to `route` (for example 'POST /presence/check-in'). */
export function failNext(fx: Fixture, route: string, failure: ApiFailure): void {
  (fx.failNext[route] ??= []).push(failure);
}

/** Count how many times a route name was requested. */
export function count(fx: Fixture, route: string): number {
  return fx.calls.filter((c) => c === route).length;
}
