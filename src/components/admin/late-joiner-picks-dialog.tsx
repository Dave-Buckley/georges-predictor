'use client'

/**
 * Admin dialog for entering pre-season picks on behalf of a late-joiner member.
 *
 * Bypasses gw1_kickoff lockout by invoking `setPreSeasonPicksForMember` (admin
 * action) which skips the lockout check. Source-list validation + duplicate
 * detection still apply server-side.
 *
 * Plan 03 wires the trigger button from the admin pre-season page.
 */

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertCircle, CheckCircle } from 'lucide-react'
import { setPreSeasonPicksForMember } from '@/actions/admin/pre-season'
import type { PreSeasonPickRow } from '@/lib/supabase/types'
import {
  PreSeasonPicker,
  EMPTY_PICKER_STATE,
  isPickerComplete,
  toSubmitPayload,
  type PickerState,
} from '@/app/(member)/pre-season/_components/pre-season-picker'

export interface LateJoinerPicksDialogProps {
  memberId: string
  memberName: string
  season: number
  plTeams: Array<{ name: string }>
  championship: readonly string[]
  existingPicks?: PreSeasonPickRow | null
  trigger?: React.ReactNode
}

function initialStateFromPicks(picks: PreSeasonPickRow | null | undefined): PickerState {
  if (!picks) return EMPTY_PICKER_STATE

  const pad = <T,>(arr: T[], len: number): (T | null)[] => {
    const next: (T | null)[] = [...arr]
    while (next.length < len) next.push(null)
    return next.slice(0, len)
  }

  return {
    top4: pad(picks.top4 ?? [], 4).map((v) => (v as string) || null),
    tenth_place: picks.tenth_place || null,
    relegated: pad(picks.relegated ?? [], 3).map((v) => (v as string) || null),
    promoted: pad(picks.promoted ?? [], 3).map((v) => (v as string) || null),
    promoted_playoff_winner: picks.promoted_playoff_winner || null,
  }
}

export function LateJoinerPicksDialog({
  memberId,
  memberName,
  season,
  plTeams,
  championship,
  existingPicks,
  trigger,
}: LateJoinerPicksDialogProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PickerState>(() =>
    initialStateFromPicks(existingPicks)
  )
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const complete = isPickerComplete(state)

  function handleOpenChange(val: boolean) {
    setOpen(val)
    if (!val) {
      // reset state on close
      setState(initialStateFromPicks(existingPicks))
      setError(null)
      setSuccess(false)
    }
  }

  function handleSubmit() {
    setError(null)
    setSuccess(false)

    if (!complete) {
      setError('All 12 picks are required before submitting.')
      return
    }

    startTransition(async () => {
      const payload = {
        ...toSubmitPayload(state, season),
        member_id: memberId,
      }
      const fd = new FormData()
      fd.set('payload', JSON.stringify(payload))

      const result = await setPreSeasonPicksForMember(fd)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setSuccess(true)
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-medium"
          >
            Enter picks
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-white">
              Pre-season picks — {memberName}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            Enter pre-season picks on behalf of {memberName} for the {season}-
            {(season + 1).toString().slice(2)} season.
          </Dialog.Description>

          <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-xs text-amber-200">
            Admin override — GW1 lockout is bypassed. Source-list + duplicate
            checks still apply.
          </div>

          <PreSeasonPicker
            state={state}
            onChange={setState}
            plTeams={plTeams}
            championship={championship}
            disabled={isPending || success}
          />

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-900/30 border border-red-700/50 p-3 text-sm text-red-200">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-900/30 border border-green-700/50 p-3 text-sm text-green-200">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Picks saved for {memberName}.</span>
            </div>
          )}

          <div className="mt-5 flex gap-3 justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800"
              >
                {success ? 'Done' : 'Cancel'}
              </button>
            </Dialog.Close>
            {!success && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!complete || isPending}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Saving…' : 'Save picks'}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
