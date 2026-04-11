import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client using the service role key.
 * This client bypasses Row Level Security — use only in secure server-side code.
 * NEVER import this in client components or expose to the browser.
 *
 * Note: Typed as SupabaseClient<any> until supabase gen types is run.
 * When the Database type is generated, update to createClient<Database>.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): ReturnType<typeof createClient<any>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
