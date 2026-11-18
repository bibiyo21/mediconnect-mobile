import { manilaToday } from './validation';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "18 December 2026" on the Manila calendar (the server reports UTC). Built by
 * hand so the text is the same on every device, whatever its locale data.
 */
export function formatManilaDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const [y, m, d] = manilaToday(date).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
