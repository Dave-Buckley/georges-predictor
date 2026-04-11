import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Handles Supabase auth callbacks — magic link clicks and email confirmations.
 * Supabase redirects to this route with a ?code= param after email verification.
 *
 * Flow:
 * 1. Extract `code` from URL search params
 * 2. Exchange code for a user session (sets auth cookies)
 * 3. Redirect to `next` param destination (default: /dashboard)
 * 4. On error: redirect to /login?error=auth
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth', origin))
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] Failed to exchange code for session:', error.message)
    return NextResponse.redirect(new URL('/login?error=auth', origin))
  }

  // Redirect to intended destination — middleware will verify auth state
  return NextResponse.redirect(new URL(next, origin))
}
