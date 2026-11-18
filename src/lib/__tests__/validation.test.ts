import { codeSchema, contactSchema, detailsSchema, formatDateInput, latestAdultBirthDate, manilaToday, newPasswordSchema, normalizeMobile, profileSchema } from '../validation';

const validDetails = {
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  date_of_birth: '1990-05-17',
  password: 'abcdefgh12',
  password_confirmation: 'abcdefgh12',
  accept_terms: true,
};

describe('contactSchema', () => {
  it.each(['juan@example.com', '09171234567', '0917 123 4567', '+639171234567', '9171234567'])('accepts %s', (contact) => {
    expect(contactSchema.safeParse({ contact }).success).toBe(true);
  });

  it.each(['', 'juan', '0817123456', '+6591234567'])('rejects %s', (contact) => {
    expect(contactSchema.safeParse({ contact }).success).toBe(false);
  });

  it('normalizes separators like the backend', () => {
    expect(normalizeMobile('0917-123 (4567)')).toBe('09171234567');
  });
});

describe('codeSchema', () => {
  it('needs exactly six digits', () => {
    expect(codeSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(codeSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(codeSchema.safeParse({ code: '12a456' }).success).toBe(false);
  });
});

describe('detailsSchema (mirrors RegisterRequest)', () => {
  it('accepts valid details', () => {
    expect(detailsSchema.safeParse(validDetails).success).toBe(true);
  });

  it('enforces the password rule: 10+ characters with letters and numbers', () => {
    for (const password of ['short1a', 'onlyletters', '1234567890']) {
      expect(detailsSchema.safeParse({ ...validDetails, password, password_confirmation: password }).success).toBe(false);
    }
  });

  it('requires matching confirmation and accepted terms', () => {
    const mismatch = detailsSchema.safeParse({ ...validDetails, password_confirmation: 'different12' });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]?.path).toEqual(['password_confirmation']);
    expect(detailsSchema.safeParse({ ...validDetails, accept_terms: false }).success).toBe(false);
  });

  it('requires a birth date and rejects future or malformed dates', () => {
    expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '' }).success).toBe(false);
    expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '1990-05-17' }).success).toBe(true);
    expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '2999-01-01' }).success).toBe(false);
    expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '17/05/1990' }).success).toBe(false);
  });
});

describe('formatDateInput', () => {
  it.each([
    ['1990', '1990'],
    ['19900', '1990-0'],
    ['199005', '1990-05'],
    ['19900517', '1990-05-17'],
    ['1990-05-17', '1990-05-17'],
    ['1990/05/17extra', '1990-05-17'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatDateInput(input)).toBe(expected);
  });
});

describe('newPasswordSchema (password reset)', () => {
  const valid = { code: '123456', password: 'abcdefgh12', password_confirmation: 'abcdefgh12' };

  it('accepts a code and a matching strong password', () => {
    expect(newPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('applies the same password rule as registration', () => {
    expect(newPasswordSchema.safeParse({ ...valid, password: 'short1', password_confirmation: 'short1' }).success).toBe(false);
  });

  it('flags a mismatched confirmation on the confirmation field', () => {
    const result = newPasswordSchema.safeParse({ ...valid, password_confirmation: 'different12' });
    expect(result.error?.issues[0]?.path).toEqual(['password_confirmation']);
  });
});

describe('adult birth date (D-37)', () => {
  it('uses the Manila calendar, which is ahead of UTC', () => {
    // 2026-11-17 17:30 UTC is already 2026-11-18 in Manila.
    const now = new Date('2026-11-17T17:30:00Z');
    expect(manilaToday(now)).toBe('2026-11-18');
    expect(latestAdultBirthDate(now)).toBe('2008-11-18');
  });

  it('accepts someone who turns 18 today and refuses someone a day younger', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-18T04:00:00Z'));
    try {
      expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '2008-11-18' }).success).toBe(true);
      const minor = detailsSchema.safeParse({ ...validDetails, date_of_birth: '2008-11-19' });
      expect(minor.success).toBe(false);
      expect(minor.error?.issues[0]?.message).toMatch(/18 or older/);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects impossible dates such as 30 February', () => {
    expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '1990-02-30' }).success).toBe(false);
  });
});

describe('profileSchema (PATCH /patients/me)', () => {
  const base = {
    first_name: 'Ana', middle_name: '', last_name: 'Reyes', date_of_birth: '1990-05-17', sex: '' as const, preferred_language: 'en' as const,
    emergency_name: '', emergency_phone: '', line1: '', line2: '', barangay: '', city: '', province: '', postal_code: '',
  };

  it('accepts a profile with the optional groups left empty', () => {
    expect(profileSchema.safeParse(base).success).toBe(true);
  });

  it('needs both name and mobile for an emergency contact, and a PH mobile', () => {
    expect(profileSchema.safeParse({ ...base, emergency_name: 'Jose' }).error?.issues[0]?.path).toEqual(['emergency_phone']);
    expect(profileSchema.safeParse({ ...base, emergency_phone: '09171234567' }).error?.issues[0]?.path).toEqual(['emergency_name']);
    expect(profileSchema.safeParse({ ...base, emergency_name: 'Jose', emergency_phone: '0281234567' }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, emergency_name: 'Jose', emergency_phone: '0917 123 4567' }).success).toBe(true);
  });

  it('needs street and city once any address field is filled, and a 4-digit postal code', () => {
    const paths = profileSchema.safeParse({ ...base, barangay: 'Poblacion' }).error?.issues.map((i) => i.path[0]);
    expect(paths).toEqual(['line1', 'city']);
    expect(profileSchema.safeParse({ ...base, line1: '1 Rizal St', city: 'Makati', postal_code: '12' }).success).toBe(false);
    expect(profileSchema.safeParse({ ...base, line1: '1 Rizal St', city: 'Makati', postal_code: '1210' }).success).toBe(true);
  });
});
