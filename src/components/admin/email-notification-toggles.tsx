'use client'

import { useState, useTransition } from 'react'
import { updateAdminSettings } from '@/actions/admin/gameweeks'

interface EmailNotificationTogglesProps {
  adminUserId: string
  initialSettings: {
    email_bonus_reminders: boolean
    email_gw_complete: boolean
    email_prize_triggered: boolean
  }
}

interface ToggleItemProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled: boolean
}

function ToggleItem({ label, description, checked, onChange, disabled }: ToggleItemProps) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer select-none">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0 pt-0.5">
        {/* Toggle switch using Tailwind peer trick */}
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
              checked ? 'bg-purple-600' : 'bg-gray-200'
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

export function EmailNotificationToggles({
  adminUserId: _adminUserId,
  initialSettings,
}: EmailNotificationTogglesProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleChange(key: keyof typeof settings, value: boolean) {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    setError(null)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('email_bonus_reminders', String(newSettings.email_bonus_reminders))
      formData.set('email_gw_complete', String(newSettings.email_gw_complete))
      formData.set('email_prize_triggered', String(newSettings.email_prize_triggered))

      const result = await updateAdminSettings(formData)
      if ('error' in result) {
        setError(result.error)
        // Revert on error
        setSettings(settings)
      } else {
        setSavedAt(new Date())
      }
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="divide-y divide-gray-100">
        <div className="px-5">
          <ToggleItem
            label="Bonus reminders"
            description="Get notified when a gameweek bonus hasn't been confirmed before the gameweek starts."
            checked={settings.email_bonus_reminders}
            onChange={(val) => handleChange('email_bonus_reminders', val)}
            disabled={isPending}
          />
        </div>
        <div className="px-5">
          <ToggleItem
            label="Gameweek completion"
            description="Get notified when all fixtures in a gameweek have finished and it's ready to close."
            checked={settings.email_gw_complete}
            onChange={(val) => handleChange('email_gw_complete', val)}
            disabled={isPending}
          />
        </div>
        <div className="px-5">
          <ToggleItem
            label="Prize triggers"
            description="Get notified when a prize condition is met and a prize award is pending your review."
            checked={settings.email_prize_triggered}
            onChange={(val) => handleChange('email_prize_triggered', val)}
            disabled={isPending}
          />
        </div>
      </div>

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Changes save automatically.
        </p>
        {isPending && (
          <p className="text-xs text-gray-400">Saving...</p>
        )}
        {!isPending && savedAt && !error && (
          <p className="text-xs text-green-600">Saved</p>
        )}
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </div>
    </div>
  )
}
