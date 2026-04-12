/**
 * Home page — re-exports the /standings view so unauthenticated visitors
 * land on the public league table by default.
 *
 * The standings page itself carries the "Join" / "Log in" CTAs in its
 * header, so no separate marketing hero is needed here.
 */
export { default } from './standings/page'
export { dynamic } from './standings/page'
