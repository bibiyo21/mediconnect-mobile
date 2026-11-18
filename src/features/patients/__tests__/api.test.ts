import { toForm, toUpdate, updateMyProfile, type MyPatientProfile } from '../api';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { PATCH: jest.fn(), GET: jest.fn() }, prepareWrites: jest.fn(async () => undefined) }));

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
