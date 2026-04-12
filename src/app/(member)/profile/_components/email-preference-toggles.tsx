'use client'

/**
 * Client component for auto-saving email opt-out toggles on the /profile page.
 *
 * Mirrors the Phase 5 admin `EmailNotificationToggles` idiom verbatim —
 * checkbox state change fires the server action immediately (no submit
 * button), optimistic update reverts on error.
 */
import { useState, useTransition } from 'react'

import { updateEmailPreferences } from '@/actions/profile'

interface Props {
  initial: {
    email_weekly_personal: boolean
    email_weekly_group: boolean
  }
}

interface ToggleItemProps {
  label: string
  description: string
  notReceiving: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled: boolean
}

function ToggleItem({
  label,
  description,
  notReceiving,
  checked,
  onChange,
  disabled,
}: ToggleItemProps) {
  return (
    <label
      className={`flex items-start justify-between gap-4 py-4 cursor-pointer select-none transition ${
        checked ? '' : 'opacity-60'
      }`}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white">{label}</p>
          {!checked && (
            <span className="text-xs uppercase tracking-wider text-amber-400">
              Not receiving
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          {checked ? description : notReceiving}
        </p>
      </div>
      <div className="flex-shrink-0 pt-0.5">
        <div className="relative inline-flex items-center">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
          <div
            className={`w-10 h-6 rounded-full transition-colors ${
              checked ? 'bg-purple-600' : 'bg-slate-600'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={() => !disabled && onChange(!checked)}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                checked ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </div>
        </div>
      </div>
    </label>
  )
}

export function EmailPreferenceToggles({ initial }: Props) {
  const [settings, setSettings] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleChange(
    key: keyof typeof settings,
    value: boolean,
  ) {
    const previous = settings
    const next = { ...settings, [key]: value }
    setSettings(next)
    setError(null)

    startTransition(async () => {
      const fd = new FormData()
      fd.set(key, String(value))
      const result = await updateEmailPreferences(fd)
      if ('success' in result && result.success) {
        setSavedAt(new Date())
      } else {
        const message = 'error' in result ? result.error : 'Save failed'
        setError(message)
        setSettings(previous)
      }
    })
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
      <div className="divide-y divide-slate-800 px-5">
        <ToggleItem
          label="Weekly personal PDF email"
          description="Your personalised PDF after each gameweek closes — your predictions, points, and H2H callouts."
          notReceiving="You won't receive the personal weekly PDF email."
          checked={settings.email_weekly_personal}
          onChange={(v) => handleChange('email_weekly_personal', v)}
          disabled={isPending}
        />
        <ToggleItem
          label="Weekly group standings PDF"
          description="The group league-table PDF shared with everyone after each gameweek closes."
          notReceiving="You won't receive the group weekly PDF email."
          checked={settings.email_weekly_group}
          onChange={(v) => handleChange('email_weekly_group', v)}
          disabled={isPending}
        />
      </div>

      <div className="px-5 py-3 bg-slate-800/50 border-t border-slate-800 flex items-center justify-between text-xs">
        <p className="text-slate-400">Changes save automatically.</p>
        {isPending && <p className="text-slate-400">Saving...</p>}
        {!isPending && savedAt && !error && (
          <p className="text-green-400">Saved</p>
        )}
        {error && <p className="text-red-400">{error}</p>}
      </div>

      <div className="px-5 py-3 bg-slate-950/50 border-t border-slate-800 text-xs text-slate-500">
        Critical emails (account approval, password reset) always fire
        regardless of these toggles.
      </div>
    </div>
  )
}
