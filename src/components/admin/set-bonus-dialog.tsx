'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Select from '@radix-ui/react-select'
import { X, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { setBonusForGameweek } from '@/actions/admin/bonuses'
import type { BonusTypeRow } from '@/lib/supabase/types'

interface SetBonusDialogProps {
  gameweekNumber: number
  gameweekId: string
  currentBonusTypeId: string | null
  bonusTypes: BonusTypeRow[]
  existingPickCount: number
  trigger?: React.ReactNode
}

type Step = 'entry' | 'confirm' | 'success'

export function SetBonusDialog({
  gameweekNumber,
  gameweekId,
  currentBonusTypeId,
  bonusTypes,
  existingPickCount,
  trigger,
}: SetBonusDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('entry')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedBonusTypeId, setSelectedBonusTypeId] = useState<string>(
    currentBonusTypeId ?? ''
  )

  const hasExistingBonus = currentBonusTypeId !== null
  const triggerLabel = hasExistingBonus ? 'Change Bonus' : 'Set Bonus'

  const selectedBonus = bonusTypes.find((b) => b.id === selectedBonusTypeId)

  function handleOpenChange(val: boolean) {
    setOpen(val)
    if (!val) {
      setStep('entry')
      setError(null)
      setSelectedBonusTypeId(currentBonusTypeId ?? '')
    }
  }

  function handlePreview() {
    if (!selectedBonusTypeId) {
      setError('Please select a bonus type')
      return
    }
    setError(null)
    setStep('confirm')
  }

  function handleConfirm() {
    setError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('gameweek_id', gameweekId)
      formData.set('bonus_type_id', selectedBonusTypeId)

      const result = await setBonusForGameweek(formData)

      if ('error' in result) {
        setError(result.error)
        setStep('entry')
        return
      }

      setStep('success')
    })
  }

  function handleSuccessClose() {
    setOpen(false)
    window.location.reload()
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-medium transition-colors"
          >
            {triggerLabel}
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-bold text-gray-900">
              {step === 'success' ? 'Bonus saved' : `${triggerLabel} — GW${gameweekNumber}`}
            </Dialog.Title>
            {step !== 'success' && (
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            )}
          </div>

          <Dialog.Description className="sr-only">
            {hasExistingBonus
              ? `Change the bonus type for Gameweek ${gameweekNumber}`
              : `Set the bonus type for Gameweek ${gameweekNumber}`}
          </Dialog.Description>

          {/* ── Step 1: Entry ── */}
          {step === 'entry' && (
            <div className="space-y-4">
              {hasExistingBonus && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                  <p className="text-xs text-gray-500">
                    Current bonus:{' '}
                    <span className="font-semibold text-gray-700">
                      {bonusTypes.find((b) => b.id === currentBonusTypeId)?.name ?? 'Unknown'}
                    </span>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bonus type
                </label>
                <Select.Root
                  value={selectedBonusTypeId}
                  onValueChange={setSelectedBonusTypeId}
                >
                  <Select.Trigger className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400">
                    <Select.Value placeholder="Select a bonus type..." />
                    <Select.Icon>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </Select.Icon>
                  </Select.Trigger>

                  <Select.Portal>
                    <Select.Content
                      className="z-[100] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
                      position="popper"
                      sideOffset={4}
                    >
                      <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white text-gray-500 cursor-default">
                        <ChevronUp className="w-4 h-4" />
                      </Select.ScrollUpButton>
                      <Select.Viewport className="max-h-64 overflow-y-auto p-1">
                        {bonusTypes.map((bt) => (
                          <Select.Item
                            key={bt.id}
                            value={bt.id}
                            className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 rounded-lg cursor-pointer hover:bg-purple-50 hover:text-purple-700 focus:outline-none focus:bg-purple-50 focus:text-purple-700 select-none data-[highlighted]:bg-purple-50 data-[highlighted]:text-purple-700"
                          >
                            <Select.ItemIndicator>
                              <Check className="w-4 h-4 text-purple-600" />
                            </Select.ItemIndicator>
                            <div className="min-w-0">
                              <Select.ItemText>{bt.name}</Select.ItemText>
                              {bt.description && (
                                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                                  {bt.description}
                                </p>
                              )}
                            </div>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                      <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white text-gray-500 cursor-default">
                        <ChevronDown className="w-4 h-4" />
                      </Select.ScrollDownButton>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>

              {error && (
                <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
              )}

              <div className="flex gap-3 justify-end pt-1">
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
                  onClick={handlePreview}
                  disabled={!selectedBonusTypeId}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Confirm ── */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Gameweek</span>
                  <span className="font-semibold text-gray-900">GW{gameweekNumber}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Bonus type</span>
                  <span className="font-semibold text-gray-900">{selectedBonus?.name}</span>
                </div>
              </div>

              {existingPickCount > 0 && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      {existingPickCount} member{existingPickCount !== 1 ? 's have' : ' has'} already picked
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Changing the bonus may affect their existing picks.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
              )}

              <div className="flex gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setStep('entry')}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-60"
                >
                  {isPending ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">Bonus saved</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    GW{gameweekNumber} bonus set to {selectedBonus?.name}.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSuccessClose}
                  className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
