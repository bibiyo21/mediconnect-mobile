/**
 * Doctor search (increment 3.6) over GET /search/doctors and specialty
 * suggestions over GET /search/specialties. Results are advisory: availability
 * and booking are revalidated by the backend in later phases (§11.6).
 *
 * Every call takes an AbortSignal. React Query passes one per query and aborts
 * it when the query key changes, so a stale request never overwrites a newer one.
 */
import { unwrap, type components, type paths } from '@mediconnect/api-client';
import { api } from '@/lib/api';

export type DoctorResult = components['schemas']['DoctorSearchResultResource'];
export type SpecialtySuggestion = components['schemas']['SpecialtySuggestionResource'];
export type ConsultationMode = 'ANY' | 'IN_PERSON' | 'ONLINE';
type DoctorQuery = NonNullable<paths['/search/doctors']['get']['parameters']['query']>;

export interface SearchFilters {
  q: string;
  city: string;
  mode: ConsultationMode;
  specialty: { specialtyId: string; subspecialtyId: string | null; name: string } | null;
}

export interface SearchPage {
  doctors: DoctorResult[];
  found: number;
  nextCursor: string | null;
  degraded: boolean;
}

export const emptyFilters: SearchFilters = { q: '', city: '', mode: 'ANY', specialty: null };

/** The query string for a set of filters: blank values are left out, text is trimmed. */
export function toDoctorQuery(filters: SearchFilters, cursor?: string): DoctorQuery {
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
