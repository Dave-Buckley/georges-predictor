'use client'

import * as Select from '@radix-ui/react-select'
import { Trophy, Check } from 'lucide-react'

export interface LosTeamOption {
  id: string
  name: string
  short_name: string | null
  crest_url: string | null
}

interface LosTeamPickerProps {
  availableTeams: LosTeamOption[]
  value: string | null
  onChange: (id: string | null) => void
  required: boolean
  disabled?: boolean
}

const UNSELECTED_VALUE = '__none__'

/**
 * Radix Select-based LOS team picker.
 *
 * Renders a touch-friendly dropdown of the teams still available to this
 * member in the current competition cycle. Each item shows the team crest
 * alongside the team's short name (fallback to full name if short is null).
 *
 * Behaviours:
 *   - Mandatory when `required` — the form disables submit when value is null.
 *   - Empty `availableTeams` list renders a subtle "no teams available" note
 *     (shouldn't happen in practice given cycle-reset in availableTeams()).
 *   - `onChange(null)` allowed via the "Clear selection" item when not required.
 */
export default function LosTeamPicker({
  availableTeams,
  value,
  onChange,
  required,
  disabled = false,
}: LosTeamPickerProps) {
  const currentTeam = value ? availableTeams.find((t) => t.id === value) ?? null : null

  if (availableTeams.length === 0) {
    return (
      <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 px-4 py-3">
        <p className="text-amber-300 text-sm">
          No teams available — wait for the next Last One Standing cycle.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
        <label className="text-sm font-semibold text-yellow-300">
          Last One Standing — Pick Your Team
          {required && <span className="ml-1 text-red-400">*</span>}
        </label>
      </div>

      <Select.Root
        value={value ?? UNSELECTED_VALUE}
        onValueChange={(val) => onChange(val === UNSELECTED_VALUE ? null : val)}
        disabled={disabled}
      >
        <Select.Trigger
          className="w-full flex items-center justify-between rounded-xl bg-slate-800 border border-yellow-500/30 px-4 py-3.5 text-white text-base focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent data-[disabled]:opacity-50 transition cursor-default"
          aria-label="Select your LOS team"
        >
          <Select.Value placeholder="Select your LOS team">
            {currentTeam ? (
              <span className="inline-flex items-center gap-2">
                {currentTeam.crest_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentTeam.crest_url}
                    alt={currentTeam.name}
                    width={24}
                    height={24}
                    loading="lazy"
                    style={{ width: 24, height: 24, objectFit: 'contain' }}
                  />
                ) : null}
                <span className="font-medium">
                  {currentTeam.short_name ?? currentTeam.name}
                </span>
              </span>
            ) : (
              <span className="text-slate-400">Select your LOS team</span>
            )}
          </Select.Value>
          <Select.Icon>
            <svg
              className="w-5 h-5 text-slate-400 ml-2 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="z-50 overflow-hidden rounded-2xl bg-slate-800 border border-slate-600 shadow-2xl shadow-black/40 max-h-[60vh]"
            position="popper"
            sideOffset={8}
          >
            <Select.Viewport className="py-1">
              {!required && (
                <>
                  <Select.Item
                    value={UNSELECTED_VALUE}
                    className="flex items-center px-4 py-3.5 text-slate-300 text-base cursor-default hover:bg-purple-600/20 focus:bg-purple-600/20 focus:outline-none data-[highlighted]:bg-purple-600/20 transition"
                  >
                    <Select.ItemText>Clear selection</Select.ItemText>
                  </Select.Item>
                  <Select.Separator className="my-1 h-px bg-slate-700" />
                </>
              )}
              {availableTeams.map((team) => (
                <Select.Item
                  key={team.id}
                  value={team.id}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 text-white text-base cursor-default hover:bg-yellow-600/15 focus:bg-yellow-600/15 focus:outline-none data-[highlighted]:bg-yellow-600/15 transition"
                >
                  <span className="inline-flex items-center gap-2.5">
                    {team.crest_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={team.crest_url}
                        alt={team.name}
                        width={24}
                        height={24}
                        loading="lazy"
                        style={{ width: 24, height: 24, objectFit: 'contain' }}
                      />
                    ) : (
                      <span
                        className="inline-flex items-center justify-center rounded-full bg-slate-600 text-white text-xs font-bold"
                        style={{ width: 24, height: 24 }}
                        aria-label={team.name}
                      >
                        {(team.short_name ?? team.name).slice(0, 3).toUpperCase()}
                      </span>
                    )}
                    <Select.ItemText>{team.short_name ?? team.name}</Select.ItemText>
                  </span>
                  <Select.ItemIndicator>
                    <Check className="w-4 h-4 text-yellow-400" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      {required && !value && (
        <p className="text-xs text-amber-400/90">
          Pick a team — remember: you can only use each team once per cycle.
        </p>
      )}
    </div>
  )
}
