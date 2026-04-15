'use client'

import { useState } from 'react'
import * as Select from '@radix-ui/react-select'

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

  function handleSelectChange(val: string) {
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
      <label className="block text-sm font-medium text-slate-300">
        Your name
      </label>

      {/* Radix Select dropdown */}
      <Select.Root
        value={selectValue}
        onValueChange={handleSelectChange}
        disabled={disabled}
      >
        <Select.Trigger
          className="w-full flex items-center justify-between rounded-xl bg-slate-800 border border-slate-600 px-4 py-4 text-white text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent data-[disabled]:opacity-50 transition cursor-default"
          aria-label="Select your name"
        >
          <Select.Value placeholder="Pick your name from the list..." />
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
            className="z-50 overflow-hidden rounded-2xl bg-slate-800 border border-slate-600 shadow-2xl shadow-black/40"
            position="popper"
            sideOffset={8}
          >
            <Select.ScrollUpButton className="flex items-center justify-center h-7 bg-slate-800 text-slate-400 cursor-default">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </Select.ScrollUpButton>
            <Select.Viewport className="py-1 max-h-[60vh] overflow-y-auto">
              {importedNames.map((name) => (
                <Select.Item
                  key={name}
                  value={name}
                  className="flex items-center px-4 py-4 text-white text-lg cursor-default hover:bg-purple-600/20 focus:bg-purple-600/20 focus:outline-none data-[highlighted]:bg-purple-600/20 transition"
                >
                  <Select.ItemText>{name}</Select.ItemText>
                </Select.Item>
              ))}

              {/* Separator before "I'm new" */}
              <Select.Separator className="my-1 h-px bg-slate-700" />

              <Select.Item
                value={NEW_MEMBER_VALUE}
                className="flex items-center px-4 py-4 text-purple-300 text-lg cursor-default hover:bg-purple-600/20 focus:bg-purple-600/20 focus:outline-none data-[highlighted]:bg-purple-600/20 transition font-medium"
              >
                <Select.ItemText>I&apos;m new — type my name</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton className="flex items-center justify-center h-7 bg-slate-800 text-slate-400 cursor-default">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

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
