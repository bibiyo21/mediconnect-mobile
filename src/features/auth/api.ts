/**
 * Auth calls, all against endpoints that exist in the backend contract
 * (openapi/openapi.json). Nothing here invents an endpoint.
 */
import { unwrap, type components } from '@mediconnect/api-client';
import Constants from 'expo-constants';
import { api, prepareWrites, session } from '@/lib/api';
import { LEGAL_VERSIONS } from '@/lib/config';
import { deviceInfo } from '@/lib/device';
import { isEmail, normalizeMobile } from '@/lib/validation';

export type Account = components['schemas']['AccountResource'];

/** Device row from GET /auth/devices (DeviceResource; the contract types it loosely). */
export interface Device {
  id: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  device_name: string | null;
  app_version: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  current: boolean;
}

interface SignedIn {
  user: Account;
  device_id: string;
  mfa: { setup_required: boolean };
  /** Native clients only; cookie (web) sign-ins have no tokens. */
  tokens?: { access_token: string | null; refresh_token: string | null };
}

export type SignInResult =
  | { kind: 'signedIn'; user: Account }
  | { kind: 'mfaRequired'; challengeId: string }
  | { kind: 'mfaSetupRequired' };

function device() {
  const info = deviceInfo();
  return info ? { ...info, app_version: Constants.expoConfig?.version ?? null } : undefined;
}

export function contactField(contact: string): { email: string } | { mobile: string } {
  const value = contact.trim();
  return isEmail(value) ? { email: value } : { mobile: normalizeMobile(value) };
}

async function completeSignIn(data: SignedIn): Promise<SignInResult> {
  if (data.mfa.setup_required) {
    // Privileged accounts must set up an authenticator first. That flow is not
    // part of the patient app; the access token is limited to MFA setup anyway.
    return { kind: 'mfaSetupRequired' };
  }
  await session.signIn(data.tokens ? { access_token: data.tokens.access_token, refresh_token: data.tokens.refresh_token, device_id: data.device_id } : null);
  return { kind: 'signedIn', user: data.user };
}

export async function signIn(identifier: string, password: string): Promise<SignInResult> {
  await prepareWrites();
  const data = unwrap(await api.POST('/auth/login', { body: { identifier: identifier.trim(), password, device: device() } })) as
    | SignedIn
    | { mfa_required: true; mfa_challenge_id: string };

  if ('mfa_required' in data) {
    return { kind: 'mfaRequired', challengeId: data.mfa_challenge_id };
  }
  return completeSignIn(data);
}

export async function completeMfa(challengeId: string, code: string): Promise<SignInResult> {
  await prepareWrites();
  const data = unwrap(await api.POST('/auth/mfa/verify', { body: { mfa_challenge_id: challengeId, code } })) as SignedIn;
  return completeSignIn(data);
}

export interface OtpChallenge {
  challenge_id: string;
  channel: 'EMAIL' | 'SMS';
  destination_masked: string;
  expires_at: string;
}

export async function requestRegistrationCode(contact: string): Promise<OtpChallenge> {
  await prepareWrites();
  return unwrap(await api.POST('/auth/otp', { body: { purpose: 'REGISTER', ...contactField(contact) } }));
}

export async function verifyCode(challengeId: string, code: string): Promise<string> {
  await prepareWrites();
  const data = unwrap(await api.POST('/auth/otp/verify', { body: { challenge_id: challengeId, code } }));
  return data.verification_token;
}

export interface RegistrationInput {
  contact: string;
  verificationToken: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth?: string;
  password: string;
  password_confirmation: string;
}

export async function register(input: RegistrationInput): Promise<SignInResult> {
  await prepareWrites();
  const body = {
    ...contactField(input.contact),
    verification_token: input.verificationToken,
    first_name: input.first_name,
    middle_name: input.middle_name || null,
    last_name: input.last_name,
    date_of_birth: input.date_of_birth || null,
    password: input.password,
    password_confirmation: input.password_confirmation,
    // The versions the app displayed (config.ts); the server refuses stale ones.
    accept_privacy_notice_version: LEGAL_VERSIONS.privacyNotice,
    accept_terms_version: LEGAL_VERSIONS.terms,
    device: device(),
  } as components['schemas']['RegisterRequest'];

  const data = unwrap(await api.POST('/auth/register', { body })) as unknown as SignedIn;
  return completeSignIn(data);
}

export async function fetchMe(): Promise<Account> {
  return unwrap(await api.GET('/auth/me'));
}

export async function fetchDevices(): Promise<Device[]> {
  return unwrap(await api.GET('/auth/devices')) as Device[];
}

export async function signOutDevice(deviceId: string): Promise<void> {
  await prepareWrites();
  unwrap(await api.DELETE('/auth/devices/{deviceId}', { params: { path: { deviceId } } }));
}

/** Ends the session on the server, then locally even if the server call fails. */
export async function signOut(): Promise<void> {
  try {
    await prepareWrites();
    await api.POST('/auth/logout');
  } finally {
    await session.signOut('user');
  }
}

/** Web build: is there a valid session cookie? */
export async function hasCookieSession(): Promise<boolean> {
  const result = await api.GET('/auth/me');
  return result.response.ok;
}
