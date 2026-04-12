import { Swords, Trophy } from 'lucide-react'

interface H2HStealBannerProps {
  position: 1 | 2
  stage: 'detected' | 'resolving' | 'resolved'
  tiedMemberNames: string[]
  winnerNames?: string[]
  viewerIsTied?: boolean
  detectedInGwNumber?: number
  resolvesInGwNumber?: number
}

/**
 * Banner rendered on a gameweek page when an H2H steal concerns it.
 *
 * Stages:
 *   - 'detected' — the steal was flagged in THIS gameweek; winner decided next week.
 *   - 'resolving' — this gameweek decides the steal (next-week showdown).
 *   - 'resolved' — showdown already happened; winner known.
 *
 * Prize language:
 *   - position=1 → jackpot (£30)
 *   - position=2 → runner-up (£10)
 */
export function H2HStealBanner({
  position,
  stage,
  tiedMemberNames,
  winnerNames,
  viewerIsTied,
  detectedInGwNumber,
  resolvesInGwNumber,
}: H2HStealBannerProps) {
  const prizeLabel = position === 1 ? 'jackpot (£30)' : 'runner-up (£10)'
  const namesText = tiedMemberNames.join(', ')

  const colorClasses =
    stage === 'resolved'
      ? 'bg-green-900/30 border-green-700/50 text-green-200'
      : 'bg-amber-900/30 border-amber-700/50 text-amber-200'

  const Icon = stage === 'resolved' ? Trophy : Swords

  let headline = ''
  let detail = ''

  if (stage === 'detected') {
    headline = `H2H Steal flagged for ${prizeLabel}`
    detail = `${namesText} tied on points in GW${detectedInGwNumber}. ${
      resolvesInGwNumber
        ? `Whoever scores most in GW${resolvesInGwNumber} wins.`
        : 'Whoever scores most next week wins.'
    }`
  } else if (stage === 'resolving') {
    headline = `H2H Steal resolving this gameweek — ${prizeLabel}`
    detail = `Highest scorer between ${namesText} wins the steal.`
  } else {
    const winners = winnerNames ?? []
    if (winners.length === 0) {
      headline = `H2H Steal resolved — ${prizeLabel}`
      detail = `No clear winner.`
    } else if (winners.length === 1) {
      headline = `H2H Steal resolved — ${prizeLabel}`
      detail = `Winner: ${winners[0]}.`
    } else {
      headline = `H2H Steal resolved — ${prizeLabel} split`
      detail = `Split between: ${winners.join(', ')}.`
    }
  }

  return (
    <div
      className={`rounded-xl border p-4 ${colorClasses}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold">{headline}</p>
          <p className="text-sm opacity-90 mt-0.5">{detail}</p>
          {viewerIsTied && stage !== 'resolved' && (
            <p className="text-sm mt-2 font-medium">
              You&apos;re in this steal — every point next week counts.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
