'use client'

/**
 * Favourite club picker for /profile.
 *
 * A native <select>, deliberately — not a Radix Select. The 28 July session
 * found Radix popups cannot be dragged past the first screenful on a phone
 * (their arrows only respond to mouse hover), which left members unable to
 * reach their own name in a long list. This list is ~100 clubs, so the same
 * trap applies. A native select hands off to the phone's own OS picker, which
 * always scrolls. See PICKUP.md.
 *
 * Auto-saves on change, mirroring EmailPreferenceToggles — no submit button,
 * optimistic update reverts on error.
 */
import { useMemo, useState, useTransition } from 'react'

import { updateFavouriteClub } from '@/actions/profile'
import { ClubBadge } from '@/components/shared/club-badge'

export interface PickerClub {
  id: string
  name: string
  tier: number | null
  badge_url: string | null
}

interface Props {
  clubs: PickerClub[]
  initialClubId: string | null
}

const TIER_LABELS: Record<number, string> = {
  1: 'Premier League',
  2: 'Championship',
  3: 'League One',
  4: 'League Two',
}

export function FavouriteClubPicker({ clubs, initialClubId }: Props) {
  const [clubId, setClubId] = useState<string | null>(initialClubId)
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const byTier = new Map<number | null, PickerClub[]>()
    for (const c of clubs) {
      const list = byTier.get(c.tier) ?? []
      list.push(c)
      byTier.set(c.tier, list)
    }
    for (const list of byTier.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    // Tiers in order, then anything unplaced last.
    const order: Array<number | null> = [1, 2, 3, 4]
    const out: Array<{ label: string; clubs: PickerClub[] }> = []
    for (const tier of order) {
      const list = byTier.get(tier)
      if (list && list.length > 0) {
        out.push({ label: TIER_LABELS[tier as number], clubs: list })
      }
    }
    const unplaced = byTier.get(null)
    if (unplaced && unplaced.length > 0) out.push({ label: 'Other', clubs: unplaced })
    return out
  }, [clubs])

  const selected = clubs.find((c) => c.id === clubId) ?? null

  function handleChange(nextId: string) {
    const previous = clubId
    const next = nextId === '' ? null : nextId
    setClubId(next)
    setError(null)

    startTransition(async () => {
      const fd = new FormData()
      fd.set('favourite_club_id', nextId)
      const result = await updateFavouriteClub(fd)
      if ('success' in result && result.success) {
        setSavedAt(new Date())
      } else {
        setError('error' in result ? result.error : 'Save failed')
        setClubId(previous)
      }
    })
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
      <div className="px-5 py-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <ClubBadge
              club={
                selected ? { url: selected.badge_url, name: selected.name } : null
              }
              size={44}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">
              {selected ? selected.name : 'No club picked yet'}
            </p>
            <p className="text-xs text-slate-400">
              {selected
                ? 'Shown next to your name in the league table.'
                : 'The King Predictor logo shows until you pick one.'}
            </p>
          </div>
        </div>

        <label className="block">
          <span className="sr-only">Favourite club</span>
          <select
            value={clubId ?? ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isPending}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white disabled:opacity-50"
          >
            <option value="">No club</option>
            {grouped.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="px-5 py-3 bg-slate-800/50 border-t border-slate-800 flex items-center justify-between text-xs">
        <p className="text-slate-400">Changes save automatically.</p>
        {isPending && <p className="text-slate-400">Saving...</p>}
        {!isPending && savedAt && !error && <p className="text-green-400">Saved</p>}
        {error && <p className="text-red-400">{error}</p>}
      </div>

      <div className="px-5 py-3 bg-slate-950/50 border-t border-slate-800 text-xs text-slate-500">
        Just for show — your club has no effect on scoring, the table, or Last
        One Standing.
      </div>
    </div>
  )
}
