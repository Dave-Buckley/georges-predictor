'use client'

import { useState } from 'react'

interface NamePickerProps {
  importedNames: string[]
  value: string
  onChange: (value: string) => void
  isNewMember: boolean
  onIsNewMemberChange: (isNew: boolean) => void
  error?: string
  disabled?: boolean
}

const NEW_MEMBER_VALUE = '__new__'

/**
 * Name picker component for the signup form.
 * Shows imported member names as a dropdown.
 * "I'm new — type my name" option reveals a text input.
 *
 * Uses a NATIVE <select> on purpose. This was a Radix Select, but its custom
 * popup could not be scrolled on some phones — Radix scrolls its own viewport
 * and its up/down arrows only react to a mouse hover, so members on mobile
 * (Daddy Dave, July 2026) could only ever see the first screenful of names and
 * had no way to reach their own. A native select hands the list to the phone's
 * OS picker, which is always scrollable on every device and needs no JS.
 * Don't swap this back to a custom dropdown.
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
  const [selectValue, setSelectValue] = useState<string>(
    isNewMember ? NEW_MEMBER_VALUE : (value || '')
  )

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setSelectValue(val)
    if (val === NEW_MEMBER_VALUE) {
      onIsNewMemberChange(true)
      onChange('')
    } else {
      onIsNewMemberChange(false)
      onChange(val)
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value)
  }

  // If no imported names exist, show text input directly
  if (importedNames.length === 0) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">
          Your name
        </label>
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder="Enter your name (as it appears in the WhatsApp group)"
          className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor="name-picker"
        className="block text-sm font-medium text-slate-300"
      >
        Your name
      </label>

      <div className="relative">
        <select
          id="name-picker"
          value={selectValue}
          onChange={handleSelectChange}
          disabled={disabled}
          aria-label="Select your name"
          className="w-full appearance-none rounded-xl bg-slate-800 border border-slate-600 pl-4 pr-12 py-4 text-white text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition cursor-pointer"
        >
          {/* bg/text set explicitly — some desktop browsers render the option
              list on the OS default (white) background otherwise. */}
          <option value="" disabled className="bg-slate-800 text-slate-400">
            Pick your name from the list...
          </option>

          {importedNames.map((name) => (
            <option key={name} value={name} className="bg-slate-800 text-white">
              {name}
            </option>
          ))}

          <option value={NEW_MEMBER_VALUE} className="bg-slate-800 text-purple-300">
            I&apos;m new — type my name
          </option>
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

      <p className="text-slate-500 text-xs">
        Can&apos;t find your name? Choose &ldquo;I&apos;m new — type my
        name&rdquo; at the bottom of the list.
      </p>

      {/* Text input revealed when "I'm new" is selected */}
      {isNewMember && (
        <input
          type="text"
          value={value}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder="Type your name (as it appears in the WhatsApp group)"
          autoFocus
          className="w-full rounded-xl bg-slate-800 border border-purple-500/50 px-4 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 transition"
        />
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
