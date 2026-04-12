import { createAdminClient } from '@/lib/supabase/admin'
import type { AdditionalPrizeRow, PrizeAwardWithDetails } from '@/lib/supabase/types'
import { ConfirmPrizeDialog } from '@/components/admin/confirm-prize-dialog'
import { createPrize } from '@/actions/admin/prizes'

export const dynamic = 'force-dynamic'

async function getPrizesData(): Promise<{
  prizes: AdditionalPrizeRow[]
  awards: PrizeAwardWithDetails[]
}> {
  try {
    const supabase = createAdminClient()

    const [prizesResult, awardsResult] = await Promise.all([
      supabase
        .from('additional_prizes')
        .select('*')
        .order('name'),
      supabase
        .from('prize_awards')
        .select(`
          *,
          prize:additional_prizes!prize_id(*),
          member:members!member_id(id, display_name)
        `)
        .order('triggered_at', { ascending: false }),
    ])

    return {
      prizes: (prizesResult.data ?? []) as AdditionalPrizeRow[],
      awards: (awardsResult.data ?? []) as PrizeAwardWithDetails[],
    }
  } catch {
    return { prizes: [], awards: [] }
  }
}

const TRIGGER_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  auto: { label: 'Auto', className: 'bg-blue-100 text-blue-700' },
  date: { label: 'Date', className: 'bg-purple-100 text-purple-700' },
  manual: { label: 'Manual', className: 'bg-gray-100 text-gray-600' },
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-600' },
}

async function AddCustomPrizeForm() {
  return (
    <form action={createPrize as unknown as (formData: FormData) => void} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Add Custom Prize</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            maxLength={100}
            placeholder="e.g. Golden Boot"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Emoji
          </label>
          <input
            name="emoji"
            type="text"
            maxLength={4}
            placeholder="e.g. 🏆"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            name="description"
            type="text"
            required
            maxLength={500}
            placeholder="e.g. Awarded to the member with the most correct scores"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trigger Type
          </label>
          <select
            name="trigger_type"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="manual">Manual</option>
            <option value="auto">Auto</option>
            <option value="date">Date</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cash Value (£)
          </label>
          <input
            name="cash_value"
            type="number"
            min="0"
            defaultValue="0"
            placeholder="e.g. 10 (= £10)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <p className="text-xs text-gray-400 mt-1">Enter full pounds (e.g. 10 for £10)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Points Value
          </label>
          <input
            name="points_value"
            type="number"
            min="0"
            defaultValue="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
        >
          Add Prize
        </button>
      </div>
    </form>
  )
}

export default async function AdminPrizesPage() {
  const { prizes, awards } = await getPrizesData()

  const pendingAwards = awards.filter((a) => a.status === 'pending')
  const resolvedAwards = awards.filter((a) => a.status !== 'pending')

  // Build a set of triggered prize IDs for status display
  const triggeredPrizeIds = new Set(awards.map((a) => a.prize_id))

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Additional Prizes</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {prizes.length} prize{prizes.length !== 1 ? 's' : ''} total —{' '}
          {prizes.filter((p) => !p.is_custom).length} predefined,{' '}
          {prizes.filter((p) => p.is_custom).length} custom
        </p>
      </div>

      {/* Add Custom Prize */}
      <AddCustomPrizeForm />

      {/* Prize List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Prizes</h2>
        {prizes.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center">
            <p className="text-gray-500 text-sm">No prizes yet. They will appear here once the database is seeded.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prizes.map((prize) => {
              const typeInfo = TRIGGER_TYPE_STYLES[prize.trigger_type] ?? TRIGGER_TYPE_STYLES.manual
              const isTriggered = triggeredPrizeIds.has(prize.id)

              return (
                <div
                  key={prize.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {prize.emoji && (
                        <span className="text-2xl leading-none">{prize.emoji}</span>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{prize.name}</p>
                        {prize.is_custom && (
                          <span className="text-xs text-purple-600 font-medium">Custom</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.className}`}>
                        {typeInfo.label}
                      </span>
                      {isTriggered && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Triggered
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{prize.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-auto pt-1 border-t border-gray-100">
                    {prize.cash_value > 0 && (
                      <span className="font-medium text-green-600">
                        £{(prize.cash_value / 100).toFixed(0)}
                      </span>
                    )}
                    {prize.points_value > 0 && (
                      <span>{prize.points_value} pts</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Triggered Awards — Pending */}
      {pendingAwards.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Pending Review ({pendingAwards.length})
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            These prizes have been triggered and are waiting for your confirmation.
          </p>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Prize</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Member</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Triggered</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingAwards.map((award) => {
                  const statusInfo = STATUS_STYLES[award.status] ?? STATUS_STYLES.pending
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const prize = (award as any).prize as AdditionalPrizeRow | null
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const memberName = ((award as any).member as { display_name?: string } | null)?.display_name ?? 'Group'

                  return (
                    <tr key={award.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {prize?.emoji && <span>{prize.emoji}</span>}
                          <span className="font-medium text-gray-900">{prize?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{memberName}</td>
                      <td className="px-5 py-4 text-gray-500">
                        {new Date(award.triggered_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <ConfirmPrizeDialog award={award} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Triggered Awards — Resolved history */}
      {resolvedAwards.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Award History</h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Prize</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Member</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Triggered</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resolvedAwards.map((award) => {
                  const statusInfo = STATUS_STYLES[award.status] ?? STATUS_STYLES.pending
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const prize = (award as any).prize as AdditionalPrizeRow | null
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const memberName = ((award as any).member as { display_name?: string } | null)?.display_name ?? 'Group'

                  return (
                    <tr key={award.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {prize?.emoji && <span>{prize.emoji}</span>}
                          <span className="font-medium text-gray-900">{prize?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{memberName}</td>
                      <td className="px-5 py-4 text-gray-500">
                        {new Date(award.triggered_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-500 text-xs max-w-xs truncate">
                        {award.notes ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {awards.length === 0 && (
        <div className="bg-gray-50 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">No prize awards yet. They&apos;ll appear here when triggered.</p>
        </div>
      )}
    </div>
  )
}
