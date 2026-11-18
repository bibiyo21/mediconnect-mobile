import { register, requestPasswordResetCode, resetPassword, signIn } from '../api';
import { api, session } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { POST: jest.fn() },
  prepareWrites: jest.fn(async () => undefined),
  session: { signIn: jest.fn(async () => undefined) },
}));

const user = { id: 'u1', email: 'a@example.test', mobile_masked: null, email_verified: true, mobile_verified: false, status: 'ACTIVE', locale: 'en', roles: ['PATIENT'], profile: null };
const ok = (data: unknown, status = 200) => ({ data: { success: true, data }, response: new Response(null, { status }) });

const registration = { contact: 'a@example.test', verificationToken: 't', first_name: 'A', last_name: 'B', password: 'abcdefgh12', password_confirmation: 'abcdefgh12' };

describe('auth api', () => {
  beforeEach(() => jest.clearAllMocks());

  it('signs in a cookie (web) session whose response has no tokens', async () => {
    jest.mocked(api.POST).mockResolvedValue(ok({ user, device_id: 'd1', mfa: { setup_required: false } }, 201) as never);

    await expect(register(registration)).resolves.toEqual({ kind: 'signedIn', user });
    expect(session.signIn).toHaveBeenCalledWith(null);
  });

  it('hands native tokens to the session', async () => {
    jest.mocked(api.POST).mockResolvedValue(ok({ user, device_id: 'd1', mfa: { setup_required: false }, tokens: { access_token: 'a', refresh_token: 'r' } }) as never);

    await signIn('a@example.test', 'pw');
    expect(session.signIn).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r', device_id: 'd1' });
  });

  it('returns the MFA challenge without signing in', async () => {
    jest.mocked(api.POST).mockResolvedValue(ok({ mfa_required: true, mfa_challenge_id: 'c1', mfa_challenge_expires_at: 'x' }) as never);

    await expect(signIn('a@example.test', 'pw')).resolves.toEqual({ kind: 'mfaRequired', challengeId: 'c1' });
    expect(session.signIn).not.toHaveBeenCalled();
  });

  it('does not sign in a privileged account that still needs MFA setup', async () => {
    jest.mocked(api.POST).mockResolvedValue(ok({ user, device_id: 'd1', mfa: { setup_required: true }, tokens: { access_token: 'limited', refresh_token: null } }) as never);

    await expect(signIn('admin@example.test', 'pw')).resolves.toEqual({ kind: 'mfaSetupRequired' });
    expect(session.signIn).not.toHaveBeenCalled();
  });

  it('sends the displayed legal versions and normalizes a mobile number', async () => {
    jest.mocked(api.POST).mockResolvedValue(ok({ user, device_id: 'd1', mfa: { setup_required: false } }, 201) as never);

    await register({ ...registration, contact: '0917 123 4567' });
    const body = (jest.mocked(api.POST).mock.calls[0] as unknown as [string, { body: Record<string, unknown> }])[1].body;
    expect(body).toMatchObject({ mobile: '09171234567', accept_terms_version: 'draft-2026-11', accept_privacy_notice_version: 'draft-2026-11' });
    expect(body).not.toHaveProperty('email');
  });
});

describe('password reset', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requests a reset code for a normalised mobile number', async () => {
    jest.mocked(api.POST).mockResolvedValue({ data: { success: true, data: { challenge_id: 'c1', channel: 'SMS', destination_masked: '•••4567', expires_at: 'x' } }, response: new Response(null, { status: 202 }) } as never);

    await expect(requestPasswordResetCode('0917 123 4567')).resolves.toMatchObject({ challenge_id: 'c1' });
    expect(jest.mocked(api.POST).mock.calls[0]).toEqual(['/auth/forgot-password', { body: { mobile: '09171234567' } }]);
  });

  it('verifies the code first, then resets with the verification token, without signing in', async () => {
    jest
      .mocked(api.POST)
      .mockResolvedValueOnce(ok({ verification_token: 'v'.repeat(64), expires_in_minutes: 10 }) as never)
      .mockResolvedValueOnce(ok({}) as never);

    await resetPassword({ contact: 'a@example.test', challengeId: 'c1', code: '123456', password: 'abcdefgh12', password_confirmation: 'abcdefgh12' });

    const calls = jest.mocked(api.POST).mock.calls as unknown as [string, { body: Record<string, unknown> }][];
    expect(calls.map((c) => c[0])).toEqual(['/auth/otp/verify', '/auth/reset-password']);
    expect(calls[1][1].body).toEqual({ email: 'a@example.test', verification_token: 'v'.repeat(64), password: 'abcdefgh12', password_confirmation: 'abcdefgh12' });
    expect(session.signIn).not.toHaveBeenCalled();
  });

  it('does not call reset when the code is wrong', async () => {
    jest.mocked(api.POST).mockResolvedValueOnce({ error: { success: false, message: 'The code is invalid.', code: 'VALIDATION_FAILED', errors: { code: ['The code is invalid.'] } }, response: new Response(null, { status: 422 }) } as never);

    await expect(resetPassword({ contact: 'a@example.test', challengeId: 'c1', code: '000000', password: 'abcdefgh12', password_confirmation: 'abcdefgh12' })).rejects.toThrow('The code is invalid.');
    expect(api.POST).toHaveBeenCalledTimes(1);
  });
});
