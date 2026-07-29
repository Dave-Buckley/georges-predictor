'use client'

import { useEffect, useState } from 'react'

interface NamePickerProps {
  importedNames: string[]
  value: string
  onChange: (value: string) => void
  isNewMember: boolean
  onIsNewMemberChange: (isNew: boolean) => void
  error?: string
  disabled?: boolean
}

type Path = 'returning' | 'new' | null

/**
 * Name step of the signup form.
 *
 * The member first says which they are — returning or new — and only then gets
 * the matching control. That split matters for two reasons:
 *
 *  1. A single combined list made a brand-new member who happens to share a
 *     name with a returning player pick that player's entry, silently taking
 *     over their points. Now the list is explicitly "players from last season".
 *  2. Only one control is ever active, so the unused one can never block
 *     submission — whichever path is chosen is enough on its own.
 *
 * The returning-player list is a NATIVE <select> on purpose. It used to be a
 * Radix Select, whose custom popup could not be scrolled on some phones —
 * Radix scrolls its own viewport and its arrows only react to a mouse hover, so
 * members could only see the first screenful of names and had no way to reach
 * their own (July 2026). A native select hands the list to the phone's OS
 * picker, which scrolls no matter how many names are in it. Don't swap this
 * back to a custom dropdown.
 */
export default function NamePicker({
  importedNames,
  value,
  onChange,
  isNewMember,
  onIsNewMemberChange,
  error,
  disabled,
}: NamePickerProps) {
  const hasReturningNames = importedNames.length > 0

  // Start undecided so the member makes a deliberate choice, unless there are
  // no unclaimed names left — then everyone signing up is necessarily new.
  const [path, setPath] = useState<Path>(() => {
    if (!hasReturningNames) return 'new'
    if (isNewMember) return 'new'
    return value ? 'returning' : null
  })

  // With no names left to claim, lock the form to the new-member path so the
  // duplicate-name guard on the server still runs.
  useEffect(() => {
    if (!hasReturningNames && !isNewMember) onIsNewMemberChange(true)
  }, [hasReturningNames, isNewMember, onIsNewMemberChange])

  function choosePath(next: Exclude<Path, null>) {
    setPath(next)
    // Clear whatever was entered on the other path so a returning player's name
    // can never be submitted as a new member, or vice versa.
    onChange('')
    onIsNewMemberChange(next === 'new')
  }

  const optionBase =
    'flex-1 flex flex-col items-start gap-1 rounded-xl border px-4 py-4 text-left transition cursor-pointer focus-within:ring-2 focus-within:ring-purple-500'
  const optionOn = 'bg-purple-600/15 border-purple-500 text-white'
  const optionOff =
    'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'

  return (
    <div className="space-y-4">
      {hasReturningNames && (
        <fieldset disabled={disabled} className="space-y-2 disabled:opacity-50">
          <legend className="block text-sm font-medium text-slate-300 mb-2">
            Are you returning or new?
          </legend>

          <div className="flex flex-col sm:flex-row gap-3">
            <label
              className={`${optionBase} ${path === 'returning' ? optionOn : optionOff}`}
            >
              <input
                type="radio"
                name="member-path"
                value="returning"
                checked={path === 'returning'}
                onChange={() => choosePath('returning')}
                className="sr-only"
              />
              <span className="font-semibold text-base">
                I am a returning participant
              </span>
              <span className="text-xs text-slate-400">
                Pick your name to keep your history
              </span>
            </label>

            <label
              className={`${optionBase} ${path === 'new' ? optionOn : optionOff}`}
            >
              <input
                type="radio"
                name="member-path"
                value="new"
                checked={path === 'new'}
                onChange={() => choosePath('new')}
                className="sr-only"
              />
              <span className="font-semibold text-base">I&apos;m new</span>
              <span className="text-xs text-slate-400">
                This is my first season
              </span>
            </label>
          </div>
        </fieldset>
      )}

      {/* ── Returning player: pick from last season's unclaimed names ───────── */}
      {path === 'returning' && (
        <div className="space-y-2">
          <label
            htmlFor="name-picker"
            className="block text-sm font-medium text-slate-300"
          >
            Your name
          </label>

          <div className="relative">
            <select
              id="name-picker"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              aria-label="Select your name"
              className="w-full appearance-none rounded-xl bg-slate-800 border border-slate-600 pl-4 pr-12 py-4 text-white text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition cursor-pointer"
            >
              {/* bg/text set explicitly — some desktop browsers render the
                  option list on the OS default (white) background otherwise. */}
              <option value="" disabled className="bg-slate-800 text-slate-400">
                Pick your name from the list...
              </option>
              {importedNames.map((name) => (
                <option key={name} value={name} className="bg-slate-800 text-white">
                  {name}
                </option>
              ))}
            </select>

            {/* Chevron — pointer-events-none so taps fall through to the select */}
            <svg
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <p className="text-slate-400 text-xs leading-relaxed">
            These are previous participants who haven&apos;t signed up yet.
            Picking your name keeps your history and points. If your name
            isn&apos;t here, someone has already claimed it — go back and choose{' '}
            <strong className="text-slate-300">I&apos;m new</strong>, or check
            with George.
          </p>
        </div>
      )}

      {/* ── New member: type a name ─────────────────────────────────────────── */}
      {path === 'new' && (
        <div className="space-y-2">
          <label
            htmlFor="new-name"
            className="block text-sm font-medium text-slate-300"
          >
            Your name
          </label>
          <input
            id="new-name"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Type your name (as it appears in the WhatsApp group)"
            autoFocus={hasReturningNames}
            className="w-full rounded-xl bg-slate-800 border border-purple-500/50 px-4 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
          />
          <p className="text-slate-400 text-xs leading-relaxed">
            Use the name the group knows you by. If someone in the league already
            uses it, we&apos;ll ask you to pick something different.
          </p>
        </div>
      )}

      {/* Undecided submits fail on the empty name, which reads as a confusing
          "Display name is required". Name the actual missing step instead. */}
      {error && (
        <p className="text-red-400 text-sm">
          {path === null
            ? "Please choose whether you're a returning participant or new."
            : error}
        </p>
      )}
    </div>
  )
}
