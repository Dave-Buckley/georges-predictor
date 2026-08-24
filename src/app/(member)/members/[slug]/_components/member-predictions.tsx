/**
 * Predictions panel on /members/[slug] — what this member picked, one
 * gameweek at a time, with navigation back through the season.
 *
 * Only ever renders what getMemberPredictionsForGameweek chose to return. The
 * kick-off gate lives there, not here; this component must not be given
 * unfiltered rows.
 */
import type {
  MemberGameweekPredictions,
  MemberPredictionRow,
} from '@/lib/profile/get-member-predictions'

import { PredictionGameweekNav } from './prediction-gameweek-nav'

interface Props {
  slug: string
  memberDisplayName: string
  viewerIsTarget: boolean
  available: number[]
  data: MemberGameweekPredictions | null
}

function Crest({ url }: { url: string | null }) {
  if (!url) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      loading="lazy"
      className="flex-shrink-0"
      style={{ width: 16, height: 16, objectFit: 'contain' }}
    />
  )
}

function PointsPill({ row }: { row: MemberPredictionRow }) {
  if (row.predictedHome === null) {
    return <span className="text-xs text-slate-600">No pick</span>
  }
  if (row.pointsAwarded === null) {
    return <span className="text-xs text-slate-500">Not scored</span>
  }
  if (row.pointsAwarded === 0) {
    return <span className="text-xs text-slate-500 tabular-nums">0</span>
  }
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${
        row.exact ? 'text-yellow-400' : 'text-pl-green'
      }`}
      title={row.exact ? 'Exact score' : 'Correct result'}
    >
      +{row.pointsAwarded}
      {row.exact ? ' ✦' : ''}
    </span>
  )
}

export function MemberPredictions({
  slug,
  memberDisplayName,
  viewerIsTarget,
  available,
  data,
}: Props) {
  const heading = viewerIsTarget
    ? 'Your predictions'
    : `${memberDisplayName}'s predictions`

  // Nothing has kicked off anywhere yet.
  if (available.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          {heading}
        </h2>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-400">
          Predictions appear here once a match kicks off. Nothing has started
          yet.
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          {heading}
        </h2>
        {data ? (
          <PredictionGameweekNav
            slug={slug}
            available={available}
            selected={data.gwNumber}
          />
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
        {!data || data.rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Nothing to show for this gameweek yet.
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-800">
              {data.rows.map((row) => (
                <div
                  key={row.fixtureId}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 text-sm">
                    <Crest url={row.homeCrest} />
                    <span className="text-slate-300 truncate">
                      {row.homeTeam}
                    </span>
                    <span className="text-slate-600 text-xs">v</span>
                    <Crest url={row.awayCrest} />
                    <span className="text-slate-300 truncate">
                      {row.awayTeam}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-sm font-semibold text-white tabular-nums w-12 text-center">
                      {row.predictedHome !== null
                        ? `${row.predictedHome}-${row.predictedAway}`
                        : '—'}
                    </span>
                    <span
                      className="text-sm text-slate-400 tabular-nums w-12 text-center"
                      title="Actual score"
                    >
                      {row.actualHome !== null
                        ? `${row.actualHome}-${row.actualAway}`
                        : '·'}
                    </span>
                    <span className="w-16 text-right">
                      <PointsPill row={row} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 bg-slate-800/50 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Predicted / actual / points
              </span>
              <span className="text-slate-200 font-semibold tabular-nums">
                GW{data.gwNumber}: {data.totalPoints} pts
              </span>
            </div>
          </>
        )}

        {data && data.hiddenCount > 0 ? (
          <div className="px-4 py-3 bg-slate-950/50 border-t border-slate-800 text-xs text-slate-500">
            {data.hiddenCount} {data.hiddenCount === 1 ? 'match has' : 'matches have'}{' '}
            not kicked off yet — those picks stay hidden until they do.
          </div>
        ) : null}
      </div>
    </section>
  )
}
