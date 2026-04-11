import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware handles two responsibilities:
 * 1. Token refresh — refreshes expired Supabase auth tokens on every request
 * 2. Route protection — enforces admin and member route access rules
 *
 * IMPORTANT: Uses getUser() not getSession() — getSession() does not validate
 * the JWT server-side and is a security risk. getUser() makes a network call
 * to Supabase Auth to validate the token.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Validate user server-side (getUser validates JWT with Supabase Auth server)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // ─── Protect /admin/* routes ────────────────────────────────────────────────
  // Allow /admin/login through (otherwise login page would redirect-loop)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const isAdmin = user?.app_metadata?.role === 'admin'
    if (!user || !isAdmin) {
      const redirectUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // ─── Protect /dashboard/* routes ────────────────────────────────────────────
  // Require authenticated user — approval check is done in the server component
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      const redirectUrl = new URL('/login', request.url)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // All other routes are public — return response with refreshed token cookies
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - image files (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
