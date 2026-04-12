/**
 * Season rollover wizard shell.
 *
 * URL-param state:
 *   ?step=1..8   → which step to render (default 1, invalid falls back to 1)
 *   ?season=X    → the season context (defaults to the current season)
 *   ?error=msg   → last action error (rendered inline per step)
 *
 * Server-rendered only. Each step component is a server component; form
 * actions embedded in each step invoke the matching server action and
 * redirect to the next ?step= URL.
 */
import { Step1Readiness } from './_components/step-1-readiness'
import { Step2Archive } from './_components/step-2-archive'
import { Step3NewSeason } from './_components/step-3-new-season'
import { Step4FixtureSync } from './_components/step-4-fixture-sync'
import { Step5Championship } from './_components/step-5-championship'
import { Step6Members } from './_components/step-6-members'
import { Step7Preseason } from './_components/step-7-preseason'
import { Step8Launch } from './_components/step-8-launch'
import { getCurrentSeason } from '@/lib/pre-season/seasons'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ step?: string; season?: string; error?: string }>
}

function parseStep(raw: string | undefined): number {
  if (!raw) return 1
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 8) return 1
  return n
}

export default async function SeasonRolloverPage({ searchParams }: PageProps) {
  const params = await searchParams
  const step = parseStep(params.step)
  const current = await getCurrentSeason()
  const currentSeason = current?.season ?? new Date().getFullYear()
  const paramSeason = params.season ? Number(params.season) : null
  const newSeason =
    paramSeason && Number.isInteger(paramSeason) ? paramSeason : currentSeason + 1

  return (
    <>
      {params.error && (
        <div className="p-4 lg:p-6 max-w-3xl">
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-900">
            <strong>Action failed:</strong> {params.error}
          </div>
        </div>
      )}

      {step === 1 && <Step1Readiness season={currentSeason} />}
      {step === 2 && <Step2Archive season={currentSeason} />}
      {step === 3 && <Step3NewSeason season={currentSeason} />}
      {step === 4 && <Step4FixtureSync newSeason={newSeason} />}
      {step === 5 && (
        <Step5Championship fromSeason={currentSeason} toSeason={newSeason} />
      )}
      {step === 6 && <Step6Members newSeason={newSeason} />}
      {step === 7 && <Step7Preseason newSeason={newSeason} />}
      {step === 8 && <Step8Launch newSeason={newSeason} />}
    </>
  )
}
