/**
 * fetch wrapper that caps Supabase Auth calls at 8s.
 *
 * If Supabase Auth hangs (Oct 2026 outage), un-capped getUser() calls freeze
 * every page until the platform timeout. With this cap supabase-js gets a
 * fetch error, returns `user: null`, and pages render as logged-out instead.
 * Database calls are left alone — only /auth/v1/ requests are capped.
 */
export const AUTH_TIMEOUT_MS = 8000

export const authTimeoutFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!url.includes('/auth/v1/') || init?.signal) return fetch(input, init)
  return fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) })
}
