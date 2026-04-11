'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import type { TeamRow, FixtureWithTeams, GameweekStatus } from '@/lib/supabase/types'
import FixtureCard from '@/components/fixtures/fixture-card'

interface AllFixturesClientProps {
  teams: TeamRow[]
  fixtures: FixtureWithTeams[]
}

const STATUS_LABEL: Record<GameweekStatus, { label: string; colour: string }> = {
  scheduled: { label: 'Upcoming', colour: 'bg-slate-600 text-slate-200' },
  active: { label: 'Active', colour: 'bg-purple-600/90 text-white' },
  complete: { label: 'Complete', colour: 'bg-green-600/90 text-white' },
}

/**
 * Client component for the all-fixtures page.
 * Handles the team filter dropdown and client-side filtering.
 * Filter state is stored in URL search params (?team=teamId) for shareability.
 */
export default function AllFixturesClient({ teams, fixtures }: AllFixturesClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedTeamId = searchParams.get('team') ?? ''

  const handleTeamChange = useCallback(
    (teamId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (teamId) {
        params.set('team', teamId)
      } else {
        params.delete('team')
      }
      router.push(`/fixtures?${params.toString()}`)
    },
    [router, searchParams]
  )

  // Client-side filter
  const filtered = selectedTeamId
    ? fixtures.filter(
        (f) => f.home_team_id === selectedTeamId || f.away_team_id === selectedTeamId
      )
    : fixtures

  // Group by gameweek number
  const byGameweek = new Map<number, FixtureWithTeams[]>()
  for (const fixture of filtered) {
    const gwNum = fixture.gameweek.number
    const existing = byGameweek.get(gwNum) ?? []
    byGameweek.set(gwNum, [...existing, fixture])
  }
  const gwNumbers = Array.from(byGameweek.keys()).sort((a, b) => a - b)

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  return (
    <div className="space-y-4">
      {/* Sticky team filter */}
      <div className="sticky top-[73px] z-10 bg-slate-950/95 backdrop-blur py-3 border-b border-slate-800">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedTeamId}
            onChange={(e) => handleTeamChange(e.target.value)}
            className="bg-slate-800 text-white text-sm font-medium rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer min-w-[180px]"
            aria-label="Filter by team"
          >
            <option value="">All Teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.short_name ?? team.name}
              </option>
            ))}
          </select>

          {selectedTeam && selectedTeam.crest_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedTeam.crest_url}
              alt={selectedTeam.name}
              width={24}
              height={24}
              loading="lazy"
              style={{ width: 24, height: 24, objectFit: 'contain' }}
            />
          )}

          <span className="text-slate-400 text-sm">
            {filtered.length} fixture{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Fixture groups by gameweek */}
      {gwNumbers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No fixtures found.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {gwNumbers.map((gwNum) => {
            const gwFixtures = byGameweek.get(gwNum)!
            const gw = gwFixtures[0].gameweek
            const statusMeta = STATUS_LABEL[gw.status as GameweekStatus] ?? STATUS_LABEL.scheduled

            return (
              <div key={gwNum} className="space-y-3">
                {/* Gameweek header */}
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">Gameweek {gwNum}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusMeta.colour}`}>
                    {statusMeta.label}
                  </span>
                </div>

                {/* Fixtures */}
                <div className="space-y-2">
                  {gwFixtures.map((fixture) => (
                    <FixtureCard key={fixture.id} fixture={fixture} showCountdown={false} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
