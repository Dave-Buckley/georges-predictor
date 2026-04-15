'use client'

/**
 * Two dropdowns — "me" vs "them" — that navigate to /compare?a=…&b=… on change.
 * Pure client component; parent renders the actual comparison.
 */
import { useRouter } from 'next/navigation'

interface MemberOption {
  slug: string
  displayName: string
}

interface CompareSelectorProps {
  members: MemberOption[]
  aSlug: string | null
  bSlug: string | null
  viewerSlug: string | null
}

export function CompareSelector({
  members,
  aSlug,
  bSlug,
  viewerSlug,
}: CompareSelectorProps) {
  const router = useRouter()

  function navigate(nextA: string | null, nextB: string | null) {
    const params = new URLSearchParams()
    if (nextA) params.set('a', nextA)
    if (nextB) params.set('b', nextB)
    const qs = params.toString()
    router.push(qs ? `/compare?${qs}` : '/compare')
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="block">
        <span className="text-xs text-slate-400 uppercase tracking-wider">
          Person A {viewerSlug && aSlug === viewerSlug ? '(you)' : null}
        </span>
        <select
          value={aSlug ?? ''}
          onChange={(e) => navigate(e.target.value || null, bSlug)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">— Pick a member —</option>
          {members.map((m) => (
            <option key={m.slug} value={m.slug} disabled={m.slug === bSlug}>
              {m.displayName}
              {viewerSlug === m.slug ? ' (you)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-slate-400 uppercase tracking-wider">
          Person B
        </span>
        <select
          value={bSlug ?? ''}
          onChange={(e) => navigate(aSlug, e.target.value || null)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">— Pick a member —</option>
          {members.map((m) => (
            <option key={m.slug} value={m.slug} disabled={m.slug === aSlug}>
              {m.displayName}
              {viewerSlug === m.slug ? ' (you)' : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export default CompareSelector
