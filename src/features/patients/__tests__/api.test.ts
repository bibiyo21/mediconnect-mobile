import { addDependent, dependentToForm, removeDependent, toForm, toUpdate, updateMyProfile, type Dependent, type MyPatientProfile } from '../api';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { PATCH: jest.fn(), GET: jest.fn(), POST: jest.fn(), DELETE: jest.fn() }, prepareWrites: jest.fn(async () => undefined) }));

const profile: MyPatientProfile = {
  id: 'p1', first_name: 'Ana', middle_name: null, last_name: 'Reyes', date_of_birth: '1990-05-17', sex: null, preferred_language: 'en',
  emergency_contact: { name: 'Jose', phone: '+639177654321' },
  address: { line1: '1 Rizal St', line2: null, barangay: null, city: 'Makati', province: null, postal_code: '1210', country_code: 'PH' },
};

describe('patient profile mapping', () => {
  it('round-trips a profile through the form', () => {
    expect(toUpdate(toForm(profile))).toEqual({
      first_name: 'Ana', middle_name: null, last_name: 'Reyes', date_of_birth: '1990-05-17', sex: null, preferred_language: 'en',
      emergency_contact: { name: 'Jose', phone: '+639177654321' },
      address: { line1: '1 Rizal St', line2: null, barangay: null, city: 'Makati', province: null, postal_code: '1210' },
    });
  });

  it('sends null for emptied groups so the server removes them', () => {
    const form = { ...toForm(profile), emergency_name: '', emergency_phone: '', line1: '', city: '', postal_code: '' };
    expect(toUpdate(form)).toMatchObject({ emergency_contact: null, address: null });
  });

  it('normalises the emergency mobile and PATCHes /patients/me', async () => {
    jest.mocked(api.PATCH).mockResolvedValue({ data: { success: true, data: profile }, response: new Response(null, { status: 200 }) } as never);

    await updateMyProfile({ ...toForm(profile), emergency_phone: '0917-765 4321' });

    const [path, init] = jest.mocked(api.PATCH).mock.calls[0] as unknown as [string, { body: { emergency_contact: unknown } }];
    expect(path).toBe('/patients/me');
    expect(init.body.emergency_contact).toEqual({ name: 'Jose', phone: '09177654321' });
  });
});

describe('dependents', () => {
  const child: Dependent = { id: 'd1', first_name: 'Lia', middle_name: null, last_name: 'Reyes', date_of_birth: '2018-03-10', sex: 'FEMALE', relationship: 'CHILD', authorized_at: '2026-11-18T00:00:00Z' };
  beforeEach(() => jest.clearAllMocks());

  it('adds with the attestation, its version and the given Idempotency-Key', async () => {
    jest.mocked(api.POST).mockResolvedValue({ data: { success: true, data: child }, response: new Response(null, { status: 201 }) } as never);

    await addDependent(dependentToForm(child), 'key-1');

    const [path, init] = jest.mocked(api.POST).mock.calls[0] as unknown as [string, { body: Record<string, unknown>; headers: Record<string, string> }];
    expect(path).toBe('/patients/me/dependents');
    expect(init.headers).toEqual({ 'Idempotency-Key': 'key-1' });
    expect(init.body).toEqual({
      first_name: 'Lia', middle_name: null, last_name: 'Reyes', date_of_birth: '2018-03-10', sex: 'FEMALE', relationship: 'CHILD',
      guardian_attestation: true, guardian_attestation_version: 'draft-2026-11',
    });
  });

  it('refuses to add without the attestation (never sends it on the user\'s behalf)', async () => {
    await expect(addDependent({ ...dependentToForm(child), guardian_attestation: false }, 'key-2')).rejects.toThrow(/attestation/);
    expect(api.POST).not.toHaveBeenCalled();
  });

  it('removes through DELETE on the dependent id', async () => {
    jest.mocked(api.DELETE).mockResolvedValue({ data: { success: true, data: {} }, response: new Response(null, { status: 200 }) } as never);
    await removeDependent('d1');
    expect(jest.mocked(api.DELETE).mock.calls[0]).toEqual(['/patients/me/dependents/{dependentId}', { params: { path: { dependentId: 'd1' } } }]);
  });
});
