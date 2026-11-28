/**
 * Public build-time configuration (EXPO_PUBLIC_* is inlined into the bundle).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

/**
 * Versions of the legal documents the user accepts at registration. The API
 * refuses any other value. Dependency: there is no public endpoint for the
 * current versions yet, so they are configured here (see docs: mobile shell).
 */
export const LEGAL_VERSIONS = {
  privacyNotice: process.env.EXPO_PUBLIC_PRIVACY_NOTICE_VERSION ?? 'draft-2026-11',
  terms: process.env.EXPO_PUBLIC_TERMS_VERSION ?? 'draft-2026-11',
} as const;

/** Version of the guardian attestation shown when adding a dependent (the API refuses others). */
export const GUARDIAN_ATTESTATION_VERSION = process.env.EXPO_PUBLIC_GUARDIAN_ATTESTATION_VERSION ?? 'draft-2026-11';

/**
 * Reverb (realtime) settings. Public values only: the app key is visible in the bundle by design.
 * With no app key the app runs without live updates and polls instead ("Updates paused").
 */
export const REALTIME = {
  appKey: process.env.EXPO_PUBLIC_REVERB_APP_KEY ?? '',
  host: process.env.EXPO_PUBLIC_REVERB_HOST ?? '',
  port: process.env.EXPO_PUBLIC_REVERB_PORT ? Number(process.env.EXPO_PUBLIC_REVERB_PORT) : undefined,
  scheme: process.env.EXPO_PUBLIC_REVERB_SCHEME === 'https' ? ('https' as const) : ('http' as const),
};
