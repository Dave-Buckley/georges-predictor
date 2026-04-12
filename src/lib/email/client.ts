/**
 * Shared Resend client wrapper.
 *
 * Replaces the per-file `new Resend(...)` instantiation in src/lib/email.ts
 * with a single lazy singleton so every caller (existing sendEmail,
 * sendWithAttachments, future orchestrators) shares one client instance.
 *
 * Returns null when RESEND_API_KEY is missing so callers can degrade
 * gracefully (Phase 1 established this contract for the auth signup flow).
 */
import { Resend } from 'resend'

let _resend: Resend | null = null

/**
 * Lazy Resend singleton. Returns null if RESEND_API_KEY isn't configured.
 */
export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

/**
 * Default "from" address. Prefers EMAIL_FROM env; falls back to the Resend
 * shared sandbox sender for dev/local testing.
 */
export const DEFAULT_FROM =
  process.env.EMAIL_FROM ?? "George's Predictor <onboarding@resend.dev>"

/**
 * Test-only hook to reset the memoised client. Not exported from the public
 * barrel — used internally to handle vi.resetModules() cycles.
 */
export function __resetResendSingleton() {
  _resend = null
}
