import { z } from 'zod'

// ─── Signup Schema ────────────────────────────────────────────────────────────

export const signupSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be 50 characters or fewer')
    .transform((val) => val.trim()),
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((val) => val.toLowerCase()),
  is_new_member: z.boolean(),
  email_opt_in: z.boolean(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export type SignupInput = z.infer<typeof signupSchema>

// ─── Login Schema ─────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((val) => val.toLowerCase()),
})

export type LoginInput = z.infer<typeof loginSchema>

// ─── Password Login Schema ────────────────────────────────────────────────────

export const passwordLoginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
})

export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>

// ─── Verify Login Code Schema ─────────────────────────────────────────────────

export const verifyLoginCodeSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((val) => val.toLowerCase()),
  // This Supabase project currently issues 8-digit OTP codes, but the OTP
  // length lives in the Supabase dashboard, not in this repo — so it can change
  // without a deploy. Accept 6–8 digits rather than hard-locking to 8: if the
  // two ever drift apart again, members can still log in instead of being
  // rejected before the code even reaches Supabase.
  token: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/, 'Enter the code from your email'),
})

export type VerifyLoginCodeInput = z.infer<typeof verifyLoginCodeSchema>
