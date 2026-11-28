/** Manila wall-clock labels without locale data (the same text on every device). Manila has no DST. */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function formatManilaTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() + MANILA_OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatShift(startsAt: string, endsAt: string): string {
  return `${formatManilaTime(startsAt)} to ${formatManilaTime(endsAt)}`;
}

/** Parses the break length: a whole number of minutes from 1 to 240 (the server's default maximum). */
export function parseBreakMinutes(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 && value <= 240 ? value : null;
}
