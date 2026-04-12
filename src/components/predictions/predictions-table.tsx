'use client'

import type { FixtureWithTeams } from '@/lib/supabase/types'
import { MemberLink } from '@/components/shared/member-link'

interface PredictionEntry {
  member_id: string
  fixture_id: string
  home_score: number
  away_score: number
}

interface PredictionsTableProps {
  members: Array<{ id: string; display_name: string }>
  fixtures: FixtureWithTeams[]
  predictions: PredictionEntry[]
}

/**
 * Admin grid table showing all members' predictions for a gameweek.
 * Rows = approved members (sorted alphabetically by display_name)
 * Columns = fixtures in the gameweek (sorted by kickoff_time)
 */
export function PredictionsTable({ members, fixtures, predictions }: PredictionsTableProps) {
  if (members.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm">No approved members found.</p>
      </div>
    )
  }

  if (fixtures.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm">No fixtures in this gameweek.</p>
      </div>
    )
  }

  // Build a lookup: member_id + fixture_id -> prediction
  const predictionMap = new Map<string, PredictionEntry>()
  for (const pred of predictions) {
    predictionMap.set(`${pred.member_id}:${pred.fixture_id}`, pred)
  }

  // Members who have submitted at least one prediction
  const submittedMemberIds = new Set(predictions.map((p) => p.member_id))

  // Sort members alphabetically (server may have done this already, but ensure it)
  const sortedMembers = [...members].sort((a, b) =>
    a.display_name.localeCompare(b.display_name)
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Sticky member name column header */}
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap min-w-[160px] border-r border-gray-200">
                Member
              </th>
              {/* Fixture columns */}
              {fixtures.map((fixture) => {
                const homeTla = fixture.home_team.tla ?? fixture.home_team.short_name ?? fixture.home_team.name.slice(0, 3).toUpperCase()
                const awayTla = fixture.away_team.tla ?? fixture.away_team.short_name ?? fixture.away_team.name.slice(0, 3).toUpperCase()
                return (
                  <th
                    key={fixture.id}
                    className="px-3 py-3 text-center font-semibold text-gray-600 whitespace-nowrap min-w-[80px] border-r border-gray-100 last:border-r-0"
                    title={`${fixture.home_team.name} vs ${fixture.away_team.name}`}
                  >
                    <div className="text-xs leading-tight">
                      <div>{homeTla}</div>
                      <div className="text-gray-400 text-[10px]">vs</div>
                      <div>{awayTla}</div>
                    </div>
                  </th>
                )
              })}
              {/* Submitted indicator column */}
              <th className="px-3 py-3 text-center font-semibold text-gray-600 whitespace-nowrap min-w-[80px]">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedMembers.map((member, rowIdx) => {
              const hasSubmitted = submittedMemberIds.has(member.id)
              const isEvenRow = rowIdx % 2 === 0

              return (
                <tr
                  key={member.id}
                  className={isEvenRow ? 'bg-white' : 'bg-gray-50/50'}
                >
                  {/* Sticky member name */}
                  <td className={`sticky left-0 z-10 px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap border-r border-gray-200 ${isEvenRow ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                          hasSubmitted ? 'bg-green-500' : 'bg-red-400'
                        }`}
                        title={hasSubmitted ? 'Has submitted' : 'No predictions submitted'}
                      />
                      <MemberLink displayName={member.display_name} className="text-sm" />
                    </div>
                  </td>

                  {/* Prediction cells */}
                  {fixtures.map((fixture) => {
                    const pred = predictionMap.get(`${member.id}:${fixture.id}`)
                    const hasResult =
                      fixture.home_score !== null && fixture.away_score !== null
                    const isCorrect =
                      hasResult &&
                      pred !== undefined &&
                      pred.home_score === fixture.home_score &&
                      pred.away_score === fixture.away_score

                    return (
                      <td
                        key={fixture.id}
                        className={`px-3 py-2.5 text-center text-sm border-r border-gray-100 last:border-r-0 ${
                          isCorrect
                            ? 'bg-green-50 text-green-800 font-semibold'
                            : pred
                              ? 'text-gray-700'
                              : 'text-gray-300'
                        }`}
                      >
                        {pred ? `${pred.home_score}-${pred.away_score}` : '—'}
                      </td>
                    )
                  })}

                  {/* Submitted status */}
                  <td className="px-3 py-2.5 text-center">
                    {hasSubmitted ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-500">
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
