'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, CheckCircle, Copy, Lock, MessageCircle, X } from 'lucide-react'
import type { FixtureWithTeams } from '@/lib/supabase/types'
import { lockPredictionsForWeek } from '@/actions/predictions'

interface WhatsAppCopyButtonProps {
  gameweekNumber: number
  memberDisplayName: string
  fixtures: FixtureWithTeams[]
  predictions: Record<string, { home_score: number | null; away_score: number | null }>
  bonusName: string | null
  bonusFixtureId: string | null
  losTeamName: string | null
}

type Step = 'idle' | 'warning' | 'copied'

/**
 * "Copy my picks to WhatsApp" button.
 *
 * Flow:
 *   1. Member taps the button → warning dialog.
 *   2. Member confirms → build WhatsApp-friendly text, copy to clipboard,
 *      call the lockPredictionsForWeek server action.
 *   3. Show the formatted text in a second dialog with a re-copy button and
 *      instructions to paste into the group chat.
 *
 * After success, the page reloads so server-side isLocked state kicks in and
 * the picker/submit UI disables.
 */
export function WhatsAppCopyButton({
  gameweekNumber,
  memberDisplayName,
  fixtures,
  predictions,
  bonusName,
  bonusFixtureId,
  losTeamName,
}: WhatsAppCopyButtonProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [copiedText, setCopiedText] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function buildWhatsAppText(): string {
    const sortedFixtures = [...fixtures].sort(
      (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime(),
    )

    const lines: string[] = []
    lines.push(`*George's Predictor — GW${gameweekNumber}*`)
    lines.push(`*${memberDisplayName}*`)
    lines.push('')

    for (const f of sortedFixtures) {
      const pick = predictions[f.id]
      const home = f.home_team?.name ?? 'Home'
      const away = f.away_team?.name ?? 'Away'
      if (pick && pick.home_score != null && pick.away_score != null) {
        const star = bonusFixtureId === f.id ? ' ⭐' : ''
        lines.push(`${home} ${pick.home_score} - ${pick.away_score} ${away}${star}`)
      } else {
        lines.push(`${home} _ - _ ${away}`)
      }
    }

    if (bonusName) {
      lines.push('')
      if (bonusName === 'Double Bubble') {
        lines.push(`⭐ Bonus: Double Bubble (points doubled this week)`)
      } else if (bonusFixtureId) {
        const bonusFixture = fixtures.find((f) => f.id === bonusFixtureId)
        if (bonusFixture) {
          const h = bonusFixture.home_team?.name ?? 'Home'
          const a = bonusFixture.away_team?.name ?? 'Away'
          lines.push(`⭐ Bonus: ${bonusName} on ${h} v ${a}`)
        } else {
          lines.push(`⭐ Bonus: ${bonusName}`)
        }
      } else {
        lines.push(`⭐ Bonus: ${bonusName}`)
      }
    }

    if (losTeamName) {
      lines.push(`🛡 LOS pick: ${losTeamName}`)
    }

    lines.push('')
    lines.push('Submitted via georges-predictor.vercel.app')
    return lines.join('\n')
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  function handleOpenChange(val: boolean) {
    setOpen(val)
    if (!val) {
      setStep('idle')
      setError(null)
    } else {
      setStep('warning')
    }
  }

  function handleConfirm() {
    setError(null)
    const text = buildWhatsAppText()

    startTransition(async () => {
      const copied = await copyToClipboard(text)
      const result = await lockPredictionsForWeek(gameweekNumber)

      if (!result.success) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        return
      }

      setCopiedText(text)
      setStep('copied')
      if (!copied) {
        setError(
          'Predictions locked, but auto-copy failed. Long-press the text below and copy manually.',
        )
      }
    })
  }

  async function handleRecopy() {
    const copied = await copyToClipboard(copiedText)
    if (!copied) setError('Could not copy — long-press and copy the text manually.')
    else setError(null)
  }

  function handleDone() {
    setOpen(false)
    // Page refresh so the server re-reads isLocked and renders the locked
    // state (disabled inputs, no submit button, "Locked" banner).
    window.location.reload()
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="w-full h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold text-base transition flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
          >
            <MessageCircle className="w-5 h-5" />
            Copy my picks to WhatsApp
          </button>
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
          <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 w-[90vw] max-w-md">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold text-white">
                {step === 'copied' ? 'Picks copied' : 'Lock your predictions?'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <Dialog.Description className="sr-only">
              {step === 'copied'
                ? 'Your predictions have been copied and locked for this gameweek.'
                : 'Warning — confirming will lock your predictions for this gameweek.'}
            </Dialog.Description>

            {step === 'warning' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-900/30 border border-amber-700/50">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-200 leading-relaxed">
                    <p className="font-semibold mb-1">This will lock your picks for GW{gameweekNumber}.</p>
                    <p>
                      We&apos;ll copy them as a WhatsApp-friendly message so you can paste
                      them into the group chat. Once you confirm, you won&apos;t be able to
                      change your predictions, bonus or LOS pick for this week unless
                      George reopens them.
                    </p>
                  </div>
                </div>

                {error && (
                  <p className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 justify-end">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
                  >
                    {isPending ? (
                      'Locking…'
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Copy + lock
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 'copied' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-900/30 border border-green-700/50">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-200 leading-relaxed">
                    <p className="font-semibold mb-1">Copied to clipboard.</p>
                    <p>Paste it into the George&apos;s Predictor WhatsApp chat.</p>
                  </div>
                </div>

                <pre className="max-h-64 overflow-y-auto text-xs bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-300 whitespace-pre-wrap font-mono">
                  {copiedText}
                </pre>

                {error && (
                  <p className="p-3 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-300 text-xs">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleRecopy}
                    className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy again
                  </button>
                  <button
                    type="button"
                    onClick={handleDone}
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
