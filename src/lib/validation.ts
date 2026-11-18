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

export const detailsSchema = z
  .object({
    first_name: z.string().trim().min(1, 'Enter your first name.').max(100),
    middle_name: z.string().trim().max(100).optional(),
    last_name: z.string().trim().min(1, 'Enter your last name.').max(100),
    date_of_birth: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || (ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)) && v > '1900-01-01' && v <= new Date().toISOString().slice(0, 10)), 'Use the format YYYY-MM-DD, for a date that is not in the future.'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(128)
      .regex(/[A-Za-z]/, 'Include at least one letter.')
      .regex(/\d/, 'Include at least one number.'),
    password_confirmation: z.string(),
    accept_terms: z.boolean().refine((v) => v, 'You need to accept the Terms of Use and Privacy Notice to continue.'),
  })
  .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: 'The passwords do not match.' });

export type ContactForm = z.infer<typeof contactSchema>;
export type SignInForm = z.infer<typeof signInSchema>;
export type CodeForm = z.infer<typeof codeSchema>;
export type DetailsForm = z.infer<typeof detailsSchema>;
