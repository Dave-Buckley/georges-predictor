/**
 * AchievementBadges — renders a member's achievements as icon badges.
 * Phase 11 Plan 02 Task 2.
 *
 * Icons come from lucide-react (already a project dependency).
 */
import { Trophy, Crown, Shield, Star } from 'lucide-react'

import type { Achievement, AchievementKind } from '@/lib/profile/stats'

interface AchievementBadgesProps {
  achievements: Achievement[]
}

const ICON_BY_KIND: Record<
  AchievementKind,
  React.ComponentType<{ className?: string }>
> = {
  'gw-winner': Trophy,
  'los-winner': Crown,
  'h2h-survivor': Shield,
  'pre-season-all-correct': Star,
  'pre-season-category-correct': Star,
}

const ACCENT_BY_KIND: Record<AchievementKind, string> = {
  'gw-winner': 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  'los-winner': 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  'h2h-survivor': 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  'pre-season-all-correct':
    'text-pl-green bg-emerald-500/10 border-emerald-500/30',
  'pre-season-category-correct':
    'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
}

export function AchievementBadges({ achievements }: AchievementBadgesProps) {
  if (achievements.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Achievements
        </h2>
        <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-center">
          No achievements yet. Predict well to earn your first badge!
        </p>
      </section>
    )
  }

  // Group by kind so duplicates render as one badge with a count.
  const grouped = new Map<
    AchievementKind,
    { label: string; detail?: string; count: number }
  >()
  for (const a of achievements) {
    const existing = grouped.get(a.kind)
    if (existing) {
      existing.count += 1
    } else {
      grouped.set(a.kind, { label: a.label, detail: a.detail, count: 1 })
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Achievements
      </h2>
      <div className="flex flex-wrap gap-2">
        {Array.from(grouped.entries()).map(([kind, { label, count }]) => {
          const Icon = ICON_BY_KIND[kind]
          const accent = ACCENT_BY_KIND[kind]
          return (
            <div
              key={kind}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium ${accent}`}
            >
              <Icon className="w-4 h-4" />
              <span>
                {count > 1 ? `${count}x ` : ''}
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default AchievementBadges
