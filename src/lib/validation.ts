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

export const detailsSchema = z
  .object({
    first_name: z.string().trim().min(1, 'Enter your first name.').max(100),
    middle_name: z.string().trim().max(100).optional(),
    last_name: z.string().trim().min(1, 'Enter your last name.').max(100),
    date_of_birth: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || (ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)) && v > '1900-01-01' && v <= new Date().toISOString().slice(0, 10)), 'Enter a real date in the past, for example 1990-05-17.'),
    password: passwordRule,
    password_confirmation: z.string(),
    accept_terms: z.boolean().refine((v) => v, 'You need to accept the Terms of Use and Privacy Notice to continue.'),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'The passwords do not match.' });

export type ContactForm = z.infer<typeof contactSchema>;
export type SignInForm = z.infer<typeof signInSchema>;
export type CodeForm = z.infer<typeof codeSchema>;
export type DetailsForm = z.infer<typeof detailsSchema>;
export type NewPasswordForm = z.infer<typeof newPasswordSchema>;
