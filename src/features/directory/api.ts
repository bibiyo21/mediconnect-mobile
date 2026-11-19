/**
 * The public doctor and clinic directory (increment 2.11). Read-only; booking
 * arrives in later phases, so nothing here reserves or pays.
 */
import { unwrap, type components } from '@mediconnect/api-client';
import { api } from '@/lib/api';

export type PublicDoctor = components['schemas']['PublicDoctorResource'];
export type PublicService = components['schemas']['DoctorServiceResource'];
export type PublicClinic = components['schemas']['PublicClinicResource'];
export type ClinicDoctor = { id: string; display_name: string; professional_title: string | null; primary_specialty: string | null; location_ids: string[] };
export type PageMeta = { page: number; per_page: number; total: number; last_page: number };

export async function fetchDoctors(page: number, city?: string): Promise<{ doctors: PublicDoctor[]; meta?: PageMeta }> {
  const query: Record<string, string | number> = { page };
  if (city && city.trim().length >= 2) query['filter[city]'] = city.trim();
  const result = await api.GET('/doctors', { params: { query: query as never } });
  return { doctors: unwrap(result), meta: (result.data as { meta?: PageMeta } | undefined)?.meta };
}

export const fetchDoctor = async (id: string) => unwrap(await api.GET('/doctors/{doctorId}', { params: { path: { doctorId: id } } }));
export const fetchDoctorServices = async (id: string) => unwrap(await api.GET('/doctors/{doctorId}/services', { params: { path: { doctorId: id } } }));
export const fetchClinic = async (id: string) => unwrap(await api.GET('/clinics/{clinicId}', { params: { path: { clinicId: id } } }));
export const fetchClinicDoctors = async (id: string) => unwrap(await api.GET('/clinics/{clinicId}/doctors', { params: { path: { clinicId: id } } })) as unknown as ClinicDoctor[];

const LANGUAGES: Record<string, string> = { en: 'English', fil: 'Filipino', ceb: 'Cebuano', ilo: 'Ilocano', hil: 'Hiligaynon' };
export const languageName = (code: string) => LANGUAGES[code] ?? code.toUpperCase();
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const BOOKING_NOTICE = 'Booking through MediConnect is not available yet. Contact the clinic directly to make an appointment.';
