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
