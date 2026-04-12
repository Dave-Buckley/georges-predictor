'use client'

/**
 * Shared 12-pick picker UI used by both the member submission form
 * and the admin late-joiner dialog.
 *
 * Pure controlled component — parent owns the state and submit handling.
 * 5 categories:
 *   - Top 4       (4 slots, PL teams)
 *   - 10th place  (1 slot, PL teams)
 *   - Relegated   (3 slots, PL teams)
 *   - Promoted    (3 slots, Championship teams)
 *   - Playoff winner (1 slot, Championship teams)
 *
 * Mobile-first: single column, full-width Radix Selects.
 */

import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

export interface PickerState {
  top4: (string | null)[]        // length 4
  tenth_place: string | null
  relegated: (string | null)[]   // length 3
  promoted: (string | null)[]    // length 3
  promoted_playoff_winner: string | null
}

interface PreSeasonPickerProps {
  state: PickerState
  onChange: (next: PickerState) => void
  plTeams: Array<{ name: string }>
  championship: readonly string[]
  disabled?: boolean
}

export const EMPTY_PICKER_STATE: PickerState = {
  top4: [null, null, null, null],
  tenth_place: null,
  relegated: [null, null, null],
  promoted: [null, null, null],
  promoted_playoff_winner: null,
}

function countFilled(state: PickerState): number {
  return (
    state.top4.filter(Boolean).length +
    (state.tenth_place ? 1 : 0) +
    state.relegated.filter(Boolean).length +
    state.promoted.filter(Boolean).length +
    (state.promoted_playoff_winner ? 1 : 0)
  )
}

export function isPickerComplete(state: PickerState): boolean {
  return countFilled(state) === 12
}

export function toSubmitPayload(state: PickerState, season: number) {
  return {
    season,
    top4: state.top4.filter((t): t is string => !!t),
    tenth_place: state.tenth_place ?? '',
    relegated: state.relegated.filter((t): t is string => !!t),
    promoted: state.promoted.filter((t): t is string => !!t),
    promoted_playoff_winner: state.promoted_playoff_winner ?? '',
  }
}

function TeamSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string | null
  onChange: (v: string) => void
  options: readonly string[]
  placeholder: string
  disabled?: boolean
}) {
  return (
    <Select.Root value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
      <Select.Trigger className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-sm text-slate-100 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-60 disabled:cursor-not-allowed">
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="z-[100] bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="max-h-64 overflow-y-auto p-1">
            {options.map((name) => (
              <Select.Item
                key={name}
                value={name}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-100 rounded-lg cursor-pointer hover:bg-purple-600/20 focus:outline-none focus:bg-purple-600/20 select-none data-[highlighted]:bg-purple-600/20"
              >
                <Select.ItemIndicator>
                  <Check className="w-4 h-4 text-purple-400" />
                </Select.ItemIndicator>
                <Select.ItemText>{name}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function SectionHeader({ title, filled, total }: { title: string; filled: number; total: number }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <span className="text-xs text-slate-400">
        {filled}/{total} selected
      </span>
    </div>
  )
}

export function PreSeasonPicker({
  state,
  onChange,
  plTeams,
  championship,
  disabled,
}: PreSeasonPickerProps) {
  const plNames = plTeams.map((t) => t.name).sort((a, b) => a.localeCompare(b))
  const champNames = [...championship].sort((a, b) => a.localeCompare(b))

  const setTop4 = (i: number, v: string) => {
    const next = [...state.top4]
    next[i] = v
    onChange({ ...state, top4: next })
  }
  const setRelegated = (i: number, v: string) => {
    const next = [...state.relegated]
    next[i] = v
    onChange({ ...state, relegated: next })
  }
  const setPromoted = (i: number, v: string) => {
    const next = [...state.promoted]
    next[i] = v
    onChange({ ...state, promoted: next })
  }

  const top4Filled = state.top4.filter(Boolean).length
  const relegatedFilled = state.relegated.filter(Boolean).length
  const promotedFilled = state.promoted.filter(Boolean).length

  return (
    <div className="space-y-5">
      {/* Top 4 */}
      <section>
        <SectionHeader title="Top 4 finishers" filled={top4Filled} total={4} />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <TeamSelect
              key={i}
              value={state.top4[i]}
              onChange={(v) => setTop4(i, v)}
              options={plNames}
              placeholder={`Top 4 — pick ${i + 1}`}
              disabled={disabled}
            />
          ))}
        </div>
      </section>

      {/* 10th place */}
      <section>
        <SectionHeader title="10th place" filled={state.tenth_place ? 1 : 0} total={1} />
        <TeamSelect
          value={state.tenth_place}
          onChange={(v) => onChange({ ...state, tenth_place: v })}
          options={plNames}
          placeholder="10th place pick"
          disabled={disabled}
        />
      </section>

      {/* Relegated */}
      <section>
        <SectionHeader title="Relegated" filled={relegatedFilled} total={3} />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <TeamSelect
              key={i}
              value={state.relegated[i]}
              onChange={(v) => setRelegated(i, v)}
              options={plNames}
              placeholder={`Relegated — pick ${i + 1}`}
              disabled={disabled}
            />
          ))}
        </div>
      </section>

      {/* Promoted */}
      <section>
        <SectionHeader title="Promoted from Championship" filled={promotedFilled} total={3} />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <TeamSelect
              key={i}
              value={state.promoted[i]}
              onChange={(v) => setPromoted(i, v)}
              options={champNames}
              placeholder={`Promoted — pick ${i + 1}`}
              disabled={disabled}
            />
          ))}
        </div>
      </section>

      {/* Playoff winner */}
      <section>
        <SectionHeader
          title="Championship playoff winner"
          filled={state.promoted_playoff_winner ? 1 : 0}
          total={1}
        />
        <TeamSelect
          value={state.promoted_playoff_winner}
          onChange={(v) => onChange({ ...state, promoted_playoff_winner: v })}
          options={champNames}
          placeholder="Playoff winner"
          disabled={disabled}
        />
      </section>
    </div>
  )
}
