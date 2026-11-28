/** Query keys for the doctor presence screens and the realtime provider. One source for both. */
export const presenceKeys = {
  me: ['presence-me'] as const,
  day: ['presence-day'] as const,
  previewPrefix: ['presence-checkout-preview'] as const,
  preview: (locationId: string) => ['presence-checkout-preview', locationId] as const,
};
