import { Trophy, XCircle, CheckCircle } from 'lucide-react'

export interface LosCurrentPick {
  team_name: string
  team_short_name: string | null
  crest_url: string | null
  gameweek_number: number
}

interface LosStatusCardProps {
  status: 'active' | 'eliminated'
  currentPick: LosCurrentPick | null
  teamsUsedCount: number
  teamsRemaining: number
  competitionNumber: number
  startsAtGw: number
  eliminatedAtGw?: number | null
}

/**
 * Member's own Last One Standing status card.
 *
 * Renders a big "You're In" / "Eliminated" banner, current-gameweek pick
 * (crest + team name), plus teams-used / teams-remaining counts.
 */
export function LosStatusCard({
  status,
  currentPick,
  teamsUsedCount,
  teamsRemaining,
  competitionNumber,
  startsAtGw,
  eliminatedAtGw,
}: LosStatusCardProps) {
  const isActive = status === 'active'

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6 space-y-5">
      {/* Status banner */}
      <div
        className={`flex items-start gap-3 rounded-xl p-4 ${
          isActive
            ? 'bg-green-900/30 border border-green-700/50'
            : 'bg-red-900/30 border border-red-700/50'
        }`}
      >
        {isActive ? (
          <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
        )}
        <div>
          <p
            className={`text-lg font-semibold ${
              isActive ? 'text-green-300' : 'text-red-300'
            }`}
          >
            {isActive ? "You're still in" : "You've been eliminated"}
          </p>
          <p className="text-sm text-slate-400 mt-0.5">
            {isActive
              ? `Competition #${competitionNumber} — started gameweek ${startsAtGw}`
              : eliminatedAtGw
                ? `Knocked out in gameweek ${eliminatedAtGw}. Next competition starts when a winner is found.`
                : 'Next competition starts when a winner is found.'}
          </p>
        </div>
      </div>

      {/* Current pick */}
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" />
          This week&apos;s pick
        </p>
        {currentPick ? (
          <div className="flex items-center gap-3 rounded-xl bg-slate-900/50 px-4 py-3">
            {currentPick.crest_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPick.crest_url}
                alt={currentPick.team_name}
                width={32}
                height={32}
                style={{ width: 32, height: 32, objectFit: 'contain' }}
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                {(currentPick.team_short_name ?? currentPick.team_name)
                  .slice(0, 3)
                  .toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-white font-medium">{currentPick.team_name}</p>
              <p className="text-xs text-slate-400">
                Gameweek {currentPick.gameweek_number}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic px-4 py-3 rounded-xl bg-slate-900/50">
            {isActive ? 'No pick submitted yet' : '—'}
          </p>
        )}
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-900/50 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Teams used
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {teamsUsedCount}
          </p>
        </div>
        <div className="rounded-xl bg-slate-900/50 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Teams remaining
          </p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">
            {teamsRemaining}
          </p>
        </div>
      </div>
    </div>
  )
}
