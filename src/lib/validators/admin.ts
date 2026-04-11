import { z } from 'zod'

// ─── Admin Login ─────────────────────────────────────────────────────────────

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export type AdminLoginInput = z.infer<typeof adminLoginSchema>

// ─── Add Member ──────────────────────────────────────────────────────────────

export const addMemberSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be 50 characters or fewer'),
  email: z.string().email('Invalid email address'),
  starting_points: z.coerce
    .number()
    .int('Starting points must be a whole number')
    .min(0, 'Starting points cannot be negative')
    .default(0),
})

export type AddMemberInput = z.infer<typeof addMemberSchema>

// ─── Update Email ─────────────────────────────────────────────────────────────

export const updateEmailSchema = z.object({
  member_id: z.string().uuid('Invalid member ID'),
  new_email: z.string().email('Invalid email address'),
})

export type UpdateEmailInput = z.infer<typeof updateEmailSchema>

// ─── Security Question ───────────────────────────────────────────────────────

export const securityQuestionSchema = z.object({
  question: z
    .string()
    .min(5, 'Question must be at least 5 characters')
    .max(200, 'Question must be 200 characters or fewer'),
  answer: z
    .string()
    .min(2, 'Answer must be at least 2 characters')
    .max(100, 'Answer must be 100 characters or fewer')
    .transform((val) => val.trim().toLowerCase()),
})

export type SecurityQuestionInput = z.infer<typeof securityQuestionSchema>

// ─── Admin Recovery ──────────────────────────────────────────────────────────

export const adminRecoverySchema = z.object({
  target_admin_email: z
    .string()
    .email('Invalid email address for the target admin'),
  security_answer: z.string().min(1, 'Security answer is required'),
  new_email: z.string().email('Invalid new email address'),
})

export type AdminRecoveryInput = z.infer<typeof adminRecoverySchema>
