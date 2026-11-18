/**
 * Client-side checks that mirror the backend rules (RegisterRequest,
 * LoginRequest, PhoneNumber). The server stays authoritative: its 422 field
 * errors are shown on the same fields.
 */
import { z } from 'zod';

const PH_MOBILE = /^(\+?63|0)?9\d{9}$/;

export function normalizeMobile(input: string): string {
  return input.replace(/[\s\-.()]/g, '');
}

export function isEmail(value: string): boolean {
  return z.email().safeParse(value.trim()).success;
}

export const contactSchema = z.object({
  contact: z
    .string()
    .trim()
    .min(1, 'Enter your email address or mobile number.')
    .refine((v) => isEmail(v) || PH_MOBILE.test(normalizeMobile(v)), 'Enter a valid email address or Philippine mobile number (09XX XXX XXXX).'),
});

export const signInSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email address or mobile number.').max(254),
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const codeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

export const mfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors the backend password rule (RegisterRequest::passwordRule). */
export const passwordRule = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128)
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

/** Formats typed digits as YYYY-MM-DD so people never have to type the dashes. */
export function formatDateInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export const newPasswordSchema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
    password: passwordRule,
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'The passwords do not match.' });

/** Minimum age to hold an account (D-37); mirrors config/mediconnect.php. */
export const MINIMUM_ACCOUNT_AGE = 18;

/** Today's date (YYYY-MM-DD) on the Manila calendar, which is how the server judges birth dates. */
export function manilaToday(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }
}

/** The latest birth date that is old enough to hold an account today. */
export function latestAdultBirthDate(now: Date = new Date()): string {
  const [y, m, d] = manilaToday(now).split('-');
  return `${Number(y) - MINIMUM_ACCOUNT_AGE}-${m}-${d}`;
}

function isRealDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** An account holder's birth date (mirrors App\Shared\Validation\BirthDate). */
export const adultBirthDate = z
  .string()
  .trim()
  .min(1, 'Enter your date of birth.')
  .refine((v) => isRealDate(v) && v > '1900-01-01', 'Enter a real date, for example 1990-05-17.')
  .refine((v) => !isRealDate(v) || v <= latestAdultBirthDate(), `You must be ${MINIMUM_ACCOUNT_AGE} or older to have an account. A parent or guardian can add a child as a dependent.`);

export const detailsSchema = z
  .object({
    first_name: z.string().trim().min(1, 'Enter your first name.').max(100),
    middle_name: z.string().trim().max(100).optional(),
    last_name: z.string().trim().min(1, 'Enter your last name.').max(100),
    date_of_birth: adultBirthDate,
    password: passwordRule,
    password_confirmation: z.string(),
    accept_terms: z.boolean().refine((v) => v, 'You need to accept the Terms of Use and Privacy Notice to continue.'),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'The passwords do not match.' });

const PH_MOBILE_ONLY = /^(\+?63|0)?9\d{9}$/;
const optionalText = (max: number) => z.string().trim().max(max);

/** PATCH /patients/me form (mirrors UpdateMyPatientProfileRequest). Empty optional groups are sent as null. */
export const profileSchema = z
  .object({
    first_name: z.string().trim().min(1, 'Enter your first name.').max(100),
    middle_name: optionalText(100),
    last_name: z.string().trim().min(1, 'Enter your last name.').max(100),
    date_of_birth: adultBirthDate,
    sex: z.enum(['', 'FEMALE', 'MALE', 'OTHER', 'UNKNOWN']),
    preferred_language: z.enum(['en', 'fil']),
    emergency_name: optionalText(200),
    emergency_phone: optionalText(20),
    line1: optionalText(255),
    line2: optionalText(255),
    barangay: optionalText(100),
    city: optionalText(100),
    province: optionalText(100),
    postal_code: optionalText(4),
  })
  .superRefine((v, ctx) => {
    if (v.emergency_name && !v.emergency_phone) ctx.addIssue({ code: 'custom', path: ['emergency_phone'], message: 'Add a mobile number for your emergency contact.' });
    if (v.emergency_phone && !v.emergency_name) ctx.addIssue({ code: 'custom', path: ['emergency_name'], message: 'Add a name for your emergency contact.' });
    if (v.emergency_phone && !PH_MOBILE_ONLY.test(normalizeMobile(v.emergency_phone))) ctx.addIssue({ code: 'custom', path: ['emergency_phone'], message: 'Enter a valid Philippine mobile number.' });
    const anyAddress = [v.line1, v.line2, v.barangay, v.city, v.province, v.postal_code].some(Boolean);
    if (anyAddress && !v.line1) ctx.addIssue({ code: 'custom', path: ['line1'], message: 'Enter the house number and street.' });
    if (anyAddress && !v.city) ctx.addIssue({ code: 'custom', path: ['city'], message: 'Enter the city or municipality.' });
    if (v.postal_code && !/^\d{4}$/.test(v.postal_code)) ctx.addIssue({ code: 'custom', path: ['postal_code'], message: 'Enter a 4-digit postal code.' });
  });

export type ProfileForm = z.infer<typeof profileSchema>;
export type ContactForm = z.infer<typeof contactSchema>;
export type SignInForm = z.infer<typeof signInSchema>;
export type CodeForm = z.infer<typeof codeSchema>;
export type DetailsForm = z.infer<typeof detailsSchema>;
export type NewPasswordForm = z.infer<typeof newPasswordSchema>;
