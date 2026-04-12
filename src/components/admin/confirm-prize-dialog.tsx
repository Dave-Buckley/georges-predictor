'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trophy, CheckCircle } from 'lucide-react'
import { confirmPrize } from '@/actions/admin/prizes'
import type { PrizeAwardWithDetails, AdditionalPrizeRow } from '@/lib/supabase/types'
import { MemberLink } from '@/components/shared/member-link'

interface ConfirmPrizeDialogProps {
  award: PrizeAwardWithDetails
}

type Step = 'entry' | 'confirm' | 'success'

export function ConfirmPrizeDialog({ award }: ConfirmPrizeDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('entry')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState(award.notes ?? '')
  const [chosenStatus, setChosenStatus] = useState<'confirmed' | 'rejected'>('confirmed')
  const [outcomeLabel, setOutcomeLabel] = useState<string>('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prize = (award as any).prize as AdditionalPrizeRow | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberName = ((award as any).member as { display_name?: string } | null)?.display_name ?? 'Group'

  const prizeName = prize?.name ?? 'Prize'
  const prizeEmoji = prize?.emoji ?? '🏆'

  const snapshotStandings = (award.snapshot_data as { standings?: { member_id: string; total: number }[] } | null)?.standings

  function handleOpenChange(val: boolean) {
    setOpen(val)
    if (!val) {
      setStep('entry')
      setError(null)
    }
  }

  function handleReviewChoice(status: 'confirmed' | 'rejected') {
    setChosenStatus(status)
    setStep('confirm')
  }

  function handleConfirm() {
    setError(null)
    const label = chosenStatus === 'confirmed' ? 'confirmed' : 'rejected'
    setOutcomeLabel(label)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('award_id', award.id)
      formData.set('status', chosenStatus)
      if (notes.trim()) formData.set('notes', notes.trim())

      const result = await confirmPrize(formData)

      if ('error' in result) {
        setError(result.error)
        setStep('entry')
        return
      }

      setStep('success')
      // Reload after a short delay to reflect new state
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="text-purple-600 hover:text-purple-700 font-medium text-xs px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-50 transition">
          Review
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6">
          {/* Close button */}
          <Dialog.Close className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X className="w-4 h-4" />
          </Dialog.Close>

          {/* ── Step 1: Entry ── */}
          {step === 'entry' && (
            <div className="space-y-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Review Prize Award
              </Dialog.Title>

              {/* Prize details */}
              <div className="bg-purple-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{prizeEmoji}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{prizeName}</p>
                    <p className="text-sm text-gray-500">
                      Triggered for:{' '}
                      {memberName === 'Group' ? (
                        <span>Group</span>
                      ) : (
                        <MemberLink displayName={memberName} className="text-sm text-gray-700" />
                      )}
                    </p>
                  </div>
                </div>
                {prize?.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{prize.description}</p>
                )}
                {prize?.cash_value != null && prize.cash_value > 0 && (
                  <p className="text-sm font-medium text-green-600">
                    Prize value: £{(prize.cash_value / 100).toFixed(0)}
                  </p>
                )}
              </div>

              {/* Standings snapshot */}
              {snapshotStandings && snapshotStandings.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Standings at trigger time</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Pos</th>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Member</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {snapshotStandings.slice(0, 10).map((entry, i) => (
                          <tr key={entry.member_id} className={i === 0 ? 'bg-amber-50' : ''}>
                            <td className="px-3 py-2 font-medium text-gray-600">{i + 1}</td>
                            <td className="px-3 py-2 text-gray-700">{entry.member_id}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-900">{entry.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Add any notes about this prize award..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleReviewChoice('confirmed')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
                >
                  Confirm Award
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewChoice('rejected')}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2.5 rounded-lg text-sm font-medium transition"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-5">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                {chosenStatus === 'confirmed' ? 'Confirm Award?' : 'Reject Award?'}
              </Dialog.Title>

              <p className="text-sm text-gray-600">
                {chosenStatus === 'confirmed'
                  ? `You are about to confirm "${prizeName}" awarded to ${memberName}. This will notify the members.`
                  : `You are about to reject the "${prizeName}" award. This can be undone by reviewing the award again.`}
              </p>

              {notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium mb-1">Notes:</p>
                  <p className="text-sm text-gray-700">{notes}</p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('entry')}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${
                    chosenStatus === 'confirmed'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isPending
                    ? 'Saving...'
                    : chosenStatus === 'confirmed'
                    ? 'Yes, Confirm'
                    : 'Yes, Reject'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'success' && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <div>
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Prize {outcomeLabel}
                </Dialog.Title>
                <p className="text-sm text-gray-500 mt-1">
                  {prizeName} has been {outcomeLabel}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700 transition"
              >
                Close
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Re-export Trophy icon for use elsewhere
export { Trophy }
