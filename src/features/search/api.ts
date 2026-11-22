/**
 * Doctor search (increment 3.6) over GET /search/doctors and specialty
 * suggestions over GET /search/specialties. Availability filters and the
 * next open time (4.8) are advisory: the backend revalidates before any hold (§11.6).
 *
 * Every call takes an AbortSignal. React Query passes one per query and aborts
 * it when the query key changes, so a stale request never overwrites a newer one.
 */
import { unwrap, type components, type paths } from '@mediconnect/api-client';
import { api } from '@/lib/api';
import { manilaToday } from '@/lib/validation';

export type DoctorResult = components['schemas']['DoctorSearchResultResource'];
export type SpecialtySuggestion = components['schemas']['SpecialtySuggestionResource'];
export type ConsultationMode = 'ANY' | 'IN_PERSON' | 'ONLINE';
type DoctorQuery = NonNullable<paths['/search/doctors']['get']['parameters']['query']>;

export type SearchDay = 'ANY' | 'TODAY' | 'TOMORROW';
export type SearchTime = 'ANY' | 'MORNING' | 'AFTERNOON' | 'EVENING';
export type SearchSort = 'relevance' | 'next_available';

export interface SearchFilters {
  q: string;
  city: string;
  mode: ConsultationMode;
  specialty: { specialtyId: string; subspecialtyId: string | null; name: string } | null;
  /** Open times on this Philippine day (4.8). */
  day?: SearchDay;
  /** Open times starting in this part of the day, Philippine time. */
  time?: SearchTime;
  sort?: SearchSort;
}

/** Start-time windows for each part of the day, Philippine time: from (inclusive) to (exclusive). */
export const TIME_WINDOWS: Record<Exclude<SearchTime, 'ANY'>, { from: string; to: string; label: string }> = {
  MORNING: { from: '06:00', to: '12:00', label: 'Morning' },
  AFTERNOON: { from: '12:00', to: '17:00', label: 'Afternoon' },
  EVENING: { from: '17:00', to: '22:00', label: 'Evening' },
};

export interface SearchPage {
  doctors: DoctorResult[];
  found: number;
  nextCursor: string | null;
  degraded: boolean;
}

export const emptyFilters: SearchFilters = { q: '', city: '', mode: 'ANY', specialty: null, day: 'ANY', time: 'ANY', sort: 'relevance' };

/** The query string for a set of filters: blank values are left out, text is trimmed. `now` is for tests. */
export function toDoctorQuery(filters: SearchFilters, cursor?: string, now: Date = new Date()): DoctorQuery {
  const query: DoctorQuery = {};
  const q = filters.q.trim();
  const city = filters.city.trim();
  if (q) query.q = q.slice(0, 100);
  if (city.length >= 2) query.city = city;
  if (filters.mode !== 'ANY') query.consultation_type = filters.mode;
  if (filters.specialty) {
    query.specialty = filters.specialty.specialtyId;
    if (filters.specialty.subspecialtyId) query.subspecialty = filters.specialty.subspecialtyId;
  }
  if (filters.day === 'TODAY') query.available_date = manilaToday(now);
  if (filters.day === 'TOMORROW') query.available_date = manilaToday(new Date(now.getTime() + 86400 * 1000));
  if (filters.time && filters.time !== 'ANY') {
    query.available_time_from = TIME_WINDOWS[filters.time].from;
    query.available_time_to = TIME_WINDOWS[filters.time].to;
  }
  if (filters.sort === 'next_available') query.sort = 'next_available';
  if (cursor) query.cursor = cursor;
  return query;
}

/** The search envelope's meta, narrowed (the generated type allows a string). */
function readMeta(meta: unknown): { found: number; nextCursor: string | null; degraded: boolean } {
  const m = typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>) : {};
  return { found: Number(m.found ?? 0) || 0, nextCursor: typeof m.next_cursor === 'string' ? m.next_cursor : null, degraded: m.degraded === true };
}

export async function searchDoctors(filters: SearchFilters, cursor: string | undefined, signal?: AbortSignal): Promise<SearchPage> {
  const result = await api.GET('/search/doctors', { params: { query: toDoctorQuery(filters, cursor) }, signal });
  const doctors = unwrap(result);
  return { doctors, ...readMeta(result.data?.meta) };
}

export async function suggestSpecialties(q: string, signal?: AbortSignal): Promise<SpecialtySuggestion[]> {
  const result = await api.GET('/search/specialties', { params: { query: { q: q.trim(), limit: 5 } }, signal });
  return unwrap(result);
}

/** "Cardiology" or "Interventional Cardiology (Cardiology)". */
export const suggestionLabel = (s: SpecialtySuggestion) => (s.kind === 'SUBSPECIALTY' && s.parent_name ? `${s.name} (${s.parent_name})` : s.name);

export const toSpecialtyFilter = (s: SpecialtySuggestion): NonNullable<SearchFilters['specialty']> => ({
  specialtyId: s.specialty_id,
  subspecialtyId: s.kind === 'SUBSPECIALTY' ? s.id : null,
  name: suggestionLabel(s),
});

export const DEGRADED_NOTICE = 'Search is running in a simpler mode right now, so results may be less complete. Check spelling, or try again in a few minutes.';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Today, 2:30 PM", "Tomorrow, 9:00 AM" or "Mon 30 Nov, 9:00 AM" in Philippine
 * time, for the next open time. Null input stays null: nothing is invented.
 */
export function formatNextOpen(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const manila = new Date(at.getTime() + 8 * 3600 * 1000);
  const h = manila.getUTCHours();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(manila.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const day = manila.toISOString().slice(0, 10);
  if (day === manilaToday(now)) return `Today, ${time}`;
  if (day === manilaToday(new Date(now.getTime() + 86400 * 1000))) return `Tomorrow, ${time}`;
  return `${WEEKDAYS[manila.getUTCDay()]} ${manila.getUTCDate()} ${MONTHS[manila.getUTCMonth()]}, ${time}`;
}
