import { codeSchema, contactSchema, detailsSchema, normalizeMobile } from '../validation';

const validDetails = {
  first_name: 'Juan',
  last_name: 'Dela Cruz',
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

  it('accepts an empty birth date and rejects future or malformed dates', () => {
    expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '' }).success).toBe(true);
    expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '1990-05-17' }).success).toBe(true);
    expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '2999-01-01' }).success).toBe(false);
    expect(detailsSchema.safeParse({ ...validDetails, date_of_birth: '17/05/1990' }).success).toBe(false);
  });
});
