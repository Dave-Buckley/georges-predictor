'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowRightLeft } from 'lucide-react'
import { moveFixture } from '@/actions/admin/fixtures'
import type { GameweekRow } from '@/lib/supabase/types'

interface MoveFixtureDialogProps {
  fixtureId: string
  currentGameweekNumber: number
  gameweeks: GameweekRow[]
  matchLabel: string
}

export function MoveFixtureDialog({
  fixtureId,
  currentGameweekNumber,
  gameweeks,
  matchLabel,
}: MoveFixtureDialogProps) {
  const [open, setOpen] = useState(false)
  const [targetGw, setTargetGw] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const otherGameweeks = gameweeks.filter((gw) => gw.number !== currentGameweekNumber)

  const handleMoveRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetGw) return
    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    setError(null)
    setConfirmOpen(false)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('fixture_id', fixtureId)
      formData.set('target_gameweek_number', targetGw)

      const result = await moveFixture(formData)

      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        window.location.reload()
      }
    })
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Move
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <Dialog.Title className="text-base font-bold text-gray-900 mb-1">
              Move fixture to different gameweek
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-5">
              Moving: <strong>{matchLabel}</strong> from GW{currentGameweekNumber}
            </Dialog.Description>

            <form onSubmit={handleMoveRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Move to gameweek
                </label>
                <select
                  required
                  value={targetGw}
                  onChange={(e) => setTargetGw(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select gameweek…</option>
                  {otherGameweeks.map((gw) => (
                    <option key={gw.id} value={String(gw.number)}>
                      Gameweek {gw.number}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
              )}

              <div className="flex gap-3 justify-end">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isPending || !targetGw}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-60"
                >
                  {isPending ? 'Moving…' : 'Move fixture'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Confirmation dialog */}
      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed z-[60] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <Dialog.Title className="text-base font-bold text-gray-900 mb-2">
              Confirm move
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-600 mb-5">
              Move <strong>{matchLabel}</strong> from GW{currentGameweekNumber} to GW{targetGw}?
              This will create an admin notification.
            </Dialog.Description>
            <div className="flex gap-3 justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-60"
              >
                {isPending ? 'Moving…' : 'Yes, move'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
