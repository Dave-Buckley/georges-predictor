import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

/**
 * Creates a Supabase client for use in Server Components, Server Actions, and Route Handlers.
 * Uses async cookies() from next/headers (Next.js 15 requirement).
 * Handles cookie get/set for token refresh automatically.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll may be called from a Server Component where cookies can't be set.
            // Token refresh via middleware handles this case.
          }
        },
      },
    }
  )
}
