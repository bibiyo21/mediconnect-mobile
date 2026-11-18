import { formatManilaDate } from '../dates';

describe('formatManilaDate', () => {
  it('shows the Manila calendar date', () => {
    // 2026-12-17 20:00 UTC is already 18 December in Manila.
    expect(formatManilaDate('2026-12-17T20:00:00Z')).toMatch(/18 December 2026/);
  });

  it('returns the input when it is not a date', () => {
    expect(formatManilaDate('soon')).toBe('soon');
  });
});
