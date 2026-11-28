/**
 * Refetch rules for realtime hints. Hints are a nudge, never data: the screen refetches the server.
 */
import { shouldRefetchOnHint } from '@mediconnect/api-client/realtime';

/** Poll interval used only while the socket is not connected (brief §4.4). */
export const PAUSED_POLL_MS = 30_000;

/** Notification types that mean the clinic changed the doctor's status (brief D-H). The text is never shown. */
export const STATUS_CHANGED_NOTICE_TYPES: ReadonlySet<string> = new Set([
  'presence.changed_by_staff',
  'presence.auto_checked_out',
]);

/**
 * Whether a hint with `hintVersion` should refetch a board the app holds at `heldVersion`.
 * Equal or newer refetches; an older hint is ignored. No held version always refetches.
 */
export function shouldRefetch(heldVersion: number | null | undefined, hintVersion: number): boolean {
  return shouldRefetchOnHint(heldVersion, hintVersion);
}

/** Polling only while the socket is not connected. A live socket returns false: no polling. */
export function refetchIntervalFor(live: boolean): number | false {
  return live ? false : PAUSED_POLL_MS;
}
