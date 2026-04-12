/**
 * Home page — re-exports the /standings view so unauthenticated visitors
 * land on the public league table by default.
 *
 * The standings page itself carries the "Join" / "Log in" CTAs in its
 * header, so no separate marketing hero is needed here.
 *
 * NOTE: Next.js 16 (Turbopack) cannot statically parse re-exports of route
 * segment config (`export { dynamic } from ...`). Declare `dynamic` directly
 * here so both `/` and `/standings` force-render on every request.
 */
export { default } from './standings/page'
export const dynamic = 'force-dynamic'
