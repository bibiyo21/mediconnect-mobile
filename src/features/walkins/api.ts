/**
 * Doctor walk-in queue and consultation calls (increment 5.9-M2). Every call is the server's answer; the app holds
 * no queue order or window rules. Writes send an Idempotency-Key chosen by the caller (see idempotency.ts).
 * Board data stays in memory only: nothing here persists it or logs it.
 */
import { ApiError, type ApiErrorBody, type components } from '@mediconnect/api-client';
import { api, prepareWrites } from '@/lib/api';

/**
 * One entry as the doctor view sends it. The OpenAPI union is narrowed here to the fields the queue reads;
 * the server decides which of them are present for a restricted view.
 */
export interface WalkInEntry {
  id: string;
  label: string;
  queue_number: number;
  status: "REGISTERED" | "WAITING" | "CALLED" | "IN_CONSULTATION" | "COMPLETED" | "SKIPPED" | "NO_SHOW" | "CANCELLED";
  queue_id: string;
  priority_level: string;
  priority_reason_code?: PriorityReasonCode | null;
  name?: string | null;
  is_guest?: boolean;
  recall_count?: number;
  consultation_id?: string | null;
  hmo_claim?: { label: string; card_name_text?: string | null } | null;
  estimate?: EstimateView | null;
}

export interface EstimateView {
  min_minutes: number | null;
  max_minutes: number | null;
  wait_status: "NOT_AVAILABLE_YET" | "ESTIMATED" | "UNKNOWN";
}

export type PriorityReasonCode = "SENIOR_PWD" | "PREGNANT" | "DOCTOR_REQUEST" | "STAFF_CONCERN" | "OTHER";
export type ConsultationStatus = components['schemas']['ConsultationStatus'];
export type Consultation = { id: string; status: ConsultationStatus; walkin_queue_entry_id: string | null };
export type PriorityLevelName = 'NORMAL' | 'PRIORITY' | 'URGENT';

/**
 * The OpenAPI document types `queues` as unknown[], so the queue shape is declared here. Only the fields the
 * queue screen reads. Entries arrive in call order from the server.
 */
export interface BoardQueue {
  id: string;
  status: 'OPEN' | 'PAUSED' | 'CLOSED';
  doctor_profile_id: string | null;
  doctor_name: string | null;
  live_count: number;
  entries: WalkInEntry[];
}

export interface QueueBoard {
  clinic_location_id: string;
  local_date: string;
  restricted: boolean;
  queues: BoardQueue[];
}

type PlainBody = Partial<ApiErrorBody> & { reason_code?: string | null };

/** An ApiError that keeps the server's top-level `reason_code` (a fixed code, never free text). */
export class WalkInError extends ApiError {
  readonly reasonCode: string | null;
  /** The server's `blocked_until` instant (UTC ISO) for an APPOINTMENT_WINDOW_PROTECTED refusal, when sent. */
  readonly blockedUntil: string | null;

  constructor(status: number, body: PlainBody | undefined) {
    super(status, body);
    this.name = 'WalkInError';
    this.reasonCode = body?.reason_code ?? null;
    const until = this.errors.blocked_until?.[0];
    this.blockedUntil = typeof until === 'string' ? until : null;
  }
}

type Result = { data?: unknown; error?: unknown; response: Response };

/** Like unwrap(), but keeps reason_code and blocked_until on the thrown error. */
function take<T>(result: Result): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new WalkInError(result.response.status, result.error as PlainBody | undefined);
  }
  return (result.data as { data: T }).data;
}

export async function fetchBoard(clinicLocationId: string, doctorId: string): Promise<QueueBoard> {
  return take<QueueBoard>(await api.GET('/walk-ins/queue', { params: { query: { clinic_location_id: clinicLocationId, doctor_id: doctorId } } }));
}

export async function fetchConsultation(id: string): Promise<Consultation> {
  return take<Consultation>(await api.GET('/consultations/{id}', { params: { path: { id } } }));
}

/** Sends the key given for this intent. The caller reuses it only to retry the same intent. */
type Key = string;

export async function callNext(queueId: string, key: Key): Promise<WalkInEntry> {
  await prepareWrites();
  return take<WalkInEntry>(await api.POST('/walk-ins/queues/{id}/call-next', { params: { path: { id: queueId }, header: { 'Idempotency-Key': key } } }));
}

/**
 * Pause and open take no Idempotency-Key: the generated contract has no header for them. A repeat answers 409
 * INVALID_STATE_TRANSITION, so the screen refetches the board instead of replaying a key.
 */
export async function pauseQueue(queueId: string): Promise<unknown> {
  await prepareWrites();
  return take<unknown>(await api.POST('/walk-ins/queues/{id}/pause', { params: { path: { id: queueId } } }));
}

export async function openQueue(queueId: string): Promise<unknown> {
  await prepareWrites();
  return take<unknown>(await api.POST('/walk-ins/queues/{id}/open', { params: { path: { id: queueId } } }));
}

/** `overrideReasonCode` is sent only for an urgent call during a protected window; the server audits it. */
export async function callEntry(entryId: string, key: Key, overrideReasonCode: PriorityReasonCode | null): Promise<WalkInEntry> {
  await prepareWrites();
  const body = overrideReasonCode ? { override_reason_code: overrideReasonCode } : {};
  return take<WalkInEntry>(await api.POST('/walk-ins/{id}/call', { params: { path: { id: entryId }, header: { 'Idempotency-Key': key } }, body }));
}

export async function recallEntry(entryId: string, key: Key): Promise<WalkInEntry> {
  await prepareWrites();
  return take<WalkInEntry>(await api.POST('/walk-ins/{id}/recall', { params: { path: { id: entryId }, header: { 'Idempotency-Key': key } } }));
}

export async function skipEntry(entryId: string, key: Key): Promise<WalkInEntry> {
  await prepareWrites();
  return take<WalkInEntry>(await api.POST('/walk-ins/{id}/skip', { params: { path: { id: entryId }, header: { 'Idempotency-Key': key } } }));
}

export async function noShowEntry(entryId: string, key: Key): Promise<WalkInEntry> {
  await prepareWrites();
  return take<WalkInEntry>(await api.POST('/walk-ins/{id}/no-show', { params: { path: { id: entryId }, header: { 'Idempotency-Key': key } } }));
}

export async function returnEntry(entryId: string, key: Key): Promise<WalkInEntry> {
  await prepareWrites();
  return take<WalkInEntry>(await api.POST('/walk-ins/{id}/return', { params: { path: { id: entryId }, header: { 'Idempotency-Key': key } } }));
}

/** Reason code only: the request has no free-text field, so a note can never be sent from this screen. */
export async function setEntryPriority(entryId: string, key: Key, level: PriorityLevelName, reasonCode: PriorityReasonCode | null): Promise<WalkInEntry> {
  await prepareWrites();
  const body = { priority_level: level, ...(level === 'NORMAL' || !reasonCode ? {} : { priority_reason_code: reasonCode }) };
  return take<WalkInEntry>(await api.POST('/walk-ins/{id}/priority', { params: { path: { id: entryId }, header: { 'Idempotency-Key': key } }, body }));
}

export async function startConsultation(consultationId: string, key: Key): Promise<Consultation> {
  await prepareWrites();
  return take<Consultation>(await api.POST('/consultations/{id}/start', { params: { path: { id: consultationId }, header: { 'Idempotency-Key': key } } }));
}

export async function endConsultation(consultationId: string, key: Key): Promise<Consultation> {
  await prepareWrites();
  return take<Consultation>(await api.POST('/consultations/{id}/end', { params: { path: { id: consultationId }, header: { 'Idempotency-Key': key } } }));
}

export async function interruptConsultation(consultationId: string, key: Key): Promise<Consultation> {
  await prepareWrites();
  return take<Consultation>(await api.POST('/consultations/{id}/interrupt', { params: { path: { id: consultationId }, header: { 'Idempotency-Key': key } } }));
}

export async function resumeConsultation(consultationId: string, key: Key): Promise<Consultation> {
  await prepareWrites();
  return take<Consultation>(await api.POST('/consultations/{id}/resume', { params: { path: { id: consultationId }, header: { 'Idempotency-Key': key } } }));
}
