/**
 * /how-it-works — public long-scroll explainer page.
 *
 * PUBLIC: no auth check. Unauthenticated visitors can read the whole page.
 *
 * Covers all 9 sections from 11-CONTEXT.md in a friendly explainer tone
 * with worked examples, followed by a 4-question FAQ. Anchor nav at the
 * top (sticky on desktop, horizontal scroll on mobile) jumps between
 * sections.
 *
 * Screenshots live in /public/how-it-works/ — see
 * docs/how-it-works-screenshot-runbook.md for how to retake them when the
 * UI changes materially.
 */
import Link from 'next/link'

import { AnchorNav } from './_components/anchor-nav'
import { FAQ } from './_components/faq'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "How It Works · George's Predictor",
  description:
    'How to play the predictor: scoring, bonuses, Last One Standing, H2H steals, pre-season picks, and prizes. A friendly guide for newcomers.',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  return (
    <div className="bg-slate-950 text-white">
      {/* ── Hero strip (Task 2 will swap in LandingHero) ────────────────── */}
      <header className="bg-gradient-to-br from-pl-purple via-pl-purple-light to-pl-purple-dark px-6 py-12 sm:py-16 text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
          How It Works
        </h1>
        <p className="mt-3 text-pl-green text-base sm:text-lg font-medium">
          The 10-year league, now on the web.
        </p>
      </header>

      <AnchorNav />

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-16">
        {/* ── 1. Welcome ──────────────────────────────────────────────── */}
        <section id="welcome" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome
          </h2>
          <p className="text-slate-300 leading-relaxed">
            George&apos;s Predictor is a Premier League prediction competition
            that&apos;s been running between a group of friends for a decade.
            Each week you predict the score of every PL fixture. You score
            points for getting the result right, more for getting the exact
            score, and bonus points for special picks. The member with the
            most points at the end of the season wins.
          </p>
          <p className="text-slate-300 leading-relaxed">
            This website is the digital home for that competition. Enter your
            scores each week, track the table, chase bonus points, and claim
            the trophy.
          </p>
        </section>

        {/* ── 2. How to play ──────────────────────────────────────────── */}
        <section id="how-to-play" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            How to play
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Every gameweek you&apos;ll see the list of Premier League fixtures
            and a score box for each one. Type in what you think the final
            score will be and hit save. You can keep editing a prediction
            until that fixture kicks off — once the referee blows the
            whistle, that one is locked.
          </p>
          <img
            src="/how-it-works/prediction-form.png"
            alt="The prediction form listing the week's PL fixtures with score inputs"
            className="rounded-xl shadow-lg mx-auto max-w-full w-full sm:max-w-md border border-slate-700"
          />
          <p className="text-slate-400 text-sm leading-relaxed">
            You don&apos;t have to predict every fixture — a blank prediction
            scores zero. But the more you pick, the more chances you have to
            rack up points.
          </p>
        </section>

        {/* ── 3. Scoring ─────────────────────────────────────────────── */}
        <section id="scoring" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Scoring
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Two ways to score on any fixture:
          </p>
          <ul className="list-disc list-inside text-slate-300 space-y-2 leading-relaxed">
            <li>
              <strong className="text-white">10 points</strong> — you got the{' '}
              <em>result</em> right (home win / draw / away win).
            </li>
            <li>
              <strong className="text-white">30 points</strong> — you got the{' '}
              <em>exact score</em> right (which also counts as getting the
              result right — the 30 replaces the 10, it doesn&apos;t add).
            </li>
          </ul>
          <div className="rounded-xl bg-pl-purple/40 border border-pl-purple-light p-5 space-y-2">
            <p className="text-pl-green font-semibold text-sm uppercase tracking-wide">
              Worked example
            </p>
            <p className="text-slate-200 leading-relaxed">
              Say you predict <strong>Arsenal 2-1 Chelsea</strong> and the
              result is <strong>Arsenal 3-2 Chelsea</strong> — you got the
              result right (Arsenal won), that&apos;s{' '}
              <strong className="text-pl-green">10 points</strong>. If
              you&apos;d predicted 3-2 exactly you&apos;d have scored{' '}
              <strong className="text-pl-green">30</strong>.
            </p>
          </div>
          <img
            src="/how-it-works/gameweek-results.png"
            alt="Gameweek results screen showing per-fixture point breakdown"
            className="rounded-xl shadow-lg mx-auto max-w-full w-full sm:max-w-md border border-slate-700"
          />
        </section>

        {/* ── 4. Bonuses ─────────────────────────────────────────────── */}
        <section id="bonuses" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Bonuses
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Every gameweek George picks a <strong>bonus type</strong> and you
            pick <strong>one fixture</strong> to apply it to (the star you
            tap on the prediction form). If your pick pays off, bonus points
            get added on top of your regular score.
          </p>
          <div className="space-y-3 text-slate-300 leading-relaxed">
            <p>
              <strong className="text-white">Brace Yourself</strong> —
              predict a player to score exactly 2 goals in your chosen match.
            </p>
            <p>
              <strong className="text-white">Captain Fantastic</strong> —
              predict a captain to score, assist or be booked in your chosen
              match.
            </p>
            <p>
              <strong className="text-white">Jose Park The Bus</strong> —
              predict under 2.5 goals in your chosen match.
            </p>
            <p>
              <strong className="text-white">Klopp Trumps</strong> — predict
              the home team to score, concede and receive 3+ yellows in your
              chosen match.
            </p>
            <p>
              <strong className="text-white">London Derby</strong> — predict
              both teams to score in your chosen match.
            </p>
            <p>
              <strong className="text-white">Pep Talk</strong> — predict the
              team to win by over 2.5 goals in your chosen match.
            </p>
            <p>
              <strong className="text-white">Roy Keane</strong> — predict the
              highest number of cards in your chosen match.
            </p>
            <p>
              <strong className="text-white">Shane Long</strong> — predict
              the fastest goal to be scored in your chosen match.
            </p>
          </div>
          <div className="rounded-xl bg-pl-purple/40 border border-pl-purple-light p-5 space-y-3">
            <p className="text-pl-green font-semibold text-sm uppercase tracking-wide">
              Double Bubble
            </p>
            <p className="text-slate-200 leading-relaxed">
              When the weekly bonus is <strong>Double Bubble</strong>, your
              whole gameweek total gets doubled — no fixture pick needed.
              These are the swing weeks where the leaderboard can really
              move.
            </p>
          </div>
          <div className="rounded-xl bg-pl-purple/40 border border-pl-purple-light p-5 space-y-3">
            <p className="text-pl-green font-semibold text-sm uppercase tracking-wide">
              Golden Glory
            </p>
            <p className="text-slate-200 leading-relaxed">
              A special in-season bonus: predict the <em>exact score</em> in
              a fixture and you score <strong>60</strong> instead of the
              usual 30. Just get the <em>result</em> right on a Golden Glory
              fixture and you still pick up{' '}
              <strong>20</strong> instead of the usual 10.
            </p>
          </div>
          <img
            src="/how-it-works/admin-bonus-panel.png"
            alt="Admin panel showing how George sets the weekly bonus type"
            className="rounded-xl shadow-lg mx-auto max-w-full w-full sm:max-w-md border border-slate-700"
          />
        </section>

        {/* ── 5. Last One Standing ────────────────────────────────────── */}
        <section
          id="last-one-standing"
          className="space-y-4 scroll-mt-24"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Last One Standing
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Running in parallel to the main competition, LOS is a weekly
            survival game. Each gameweek you pick <strong>one team</strong>{' '}
            you think will win. If they win, you survive to next week. If
            they draw or lose, you&apos;re out.
          </p>
          <ul className="list-disc list-inside text-slate-300 space-y-2 leading-relaxed">
            <li>You can&apos;t pick the same team twice in one cycle.</li>
            <li>
              Once you&apos;ve worked through all 20 PL teams, the pool
              resets.
            </li>
            <li>
              Last member standing claims the LOS prize. If multiple people
              survive to the end of the season, the cycle runs again next
              season with a fresh pool.
            </li>
          </ul>
          <img
            src="/how-it-works/los-picker.png"
            alt="The LOS team picker showing available and used teams"
            className="rounded-xl shadow-lg mx-auto max-w-full w-full sm:max-w-md border border-slate-700"
          />
        </section>

        {/* ── 6. H2H Steals ───────────────────────────────────────────── */}
        <section id="h2h-steals" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            H2H Steals
          </h2>
          <p className="text-slate-300 leading-relaxed">
            What happens when two people tie for the weekly top score? They
            head into a <strong>head-to-head steal</strong> the following
            gameweek. Whoever scores higher in that next GW takes the
            previous week&apos;s weekly prize. Tie again? The steal rolls
            forward until someone breaks it.
          </p>
          <p className="text-slate-300 leading-relaxed">
            This keeps the pressure on all season — no one gets to cruise
            after a big week, because next week someone else might be
            hunting them down.
          </p>
        </section>

        {/* ── 7. Pre-Season Predictions ───────────────────────────────── */}
        <section id="pre-season" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Pre-Season Predictions
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Before the season kicks off, every member submits three sets of
            picks:
          </p>
          <ul className="list-disc list-inside text-slate-300 space-y-2 leading-relaxed">
            <li>
              <strong className="text-white">Top 4</strong> — which 4 PL
              teams will finish in the Champions League spots.
            </li>
            <li>
              <strong className="text-white">Relegated</strong> — which 3 PL
              teams will go down.
            </li>
            <li>
              <strong className="text-white">Promoted</strong> — which 3
              Championship teams will come up.
            </li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            Each correct team is worth <strong>30 points</strong> at
            season&apos;s end. Get everything right in a category and
            there&apos;s a clean-sweep bonus. These are locked in before GW1
            kicks off and count toward your season total at the end.
          </p>
          <img
            src="/how-it-works/pre-season-form.png"
            alt="The pre-season prediction form with top-4, relegation and promoted sections"
            className="rounded-xl shadow-lg mx-auto max-w-full w-full sm:max-w-md border border-slate-700"
          />
        </section>

        {/* ── 8. Prizes ──────────────────────────────────────────────── */}
        <section id="prizes" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Prizes
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Plenty up for grabs through the season:
          </p>
          <div className="space-y-4">
            <div className="rounded-xl bg-pl-purple/30 border border-pl-purple-light p-4 space-y-2">
              <p className="text-pl-green font-semibold text-sm uppercase tracking-wide">
                Ongoing prizes
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-1.5 leading-relaxed">
                <li>
                  <strong className="text-white">Jackpot 1st</strong> —
                  £30/week to the highest scorer each gameweek.
                </li>
                <li>
                  <strong className="text-white">Jackpot 2nd</strong> —
                  £10/week to the second-highest scorer.
                </li>
                <li>
                  <strong className="text-white">Last One Standing</strong>{' '}
                  — £50 to the final player standing in each LOS game.
                </li>
              </ul>
            </div>
            <div>
              <p className="text-slate-300 leading-relaxed mb-2">
                One-off prizes — £10 each, first to trigger wins:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-1.5 leading-relaxed">
                <li>
                  <strong className="text-white">180</strong> — first member
                  to score 180+ in a single week.
                </li>
                <li>
                  <strong className="text-white">Bonus King</strong> — first
                  to earn 3 consecutive bonuses.
                </li>
                <li>
                  <strong className="text-white">Centurion</strong> — first
                  to reach 1000 total points.
                </li>
                <li>
                  <strong className="text-white">Christmas Present</strong>{' '}
                  — league leader on Christmas Day.
                </li>
                <li>
                  <strong className="text-white">Dry January</strong> —
                  lowest scorer at the end of January.
                </li>
                <li>
                  <strong className="text-white">Easter Egg</strong> —
                  overall losing player on Easter Sunday.
                </li>
                <li>
                  <strong className="text-white">Fresh Start</strong> —
                  highest scoring player in the first gameweek.
                </li>
                <li>
                  <strong className="text-white">Halloween Horror Show</strong>{' '}
                  — member in 31st place on Halloween.
                </li>
                <li>
                  <strong className="text-white">Knockout</strong> — first
                  to lose 2 H2H steals.
                </li>
                <li>
                  <strong className="text-white">Smart One Standing</strong>{' '}
                  — first to reach the final 10 in 3 separate LOS games.
                </li>
                <li>
                  <strong className="text-white">Valentines Surprise</strong>{' '}
                  — members in 6th & 9th on Valentine&apos;s Day.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── 9. FAQ ─────────────────────────────────────────────────── */}
        <section id="faq" className="space-y-4 scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">FAQ</h2>
          <FAQ />
        </section>

        {/* ── Printable guide ──────────────────────────────────────────── */}
        <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6 sm:p-7 text-center space-y-3">
          <h3 className="text-xl font-semibold text-white">Want the printable version?</h3>
          <p className="text-slate-400 text-sm">
            Download the full members guide as a PDF — good to share or print.
          </p>
          <a
            href="/guide/members-guide.pdf"
            target="_blank"
            rel="noopener"
            className="inline-block rounded-xl bg-pl-green px-6 py-3 font-semibold text-pl-purple hover:bg-white transition"
          >
            Download members guide (PDF)
          </a>
        </section>

        {/* ── Close / CTA ─────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-gradient-to-br from-pl-purple to-pl-purple-dark border border-pl-purple-light p-6 sm:p-8 text-center space-y-4">
          <h3 className="text-2xl font-bold text-white">
            Ready to play?
          </h3>
          <p className="text-slate-200">
            Join the competition or log in to put in your predictions.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-pl-green px-6 py-3 font-semibold text-pl-purple hover:bg-white transition"
            >
              Join the competition
            </Link>
            <Link
              href="/login"
              className="inline-block rounded-xl border border-pl-green px-6 py-3 font-semibold text-pl-green hover:bg-pl-green/10 transition"
            >
              Member login
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
