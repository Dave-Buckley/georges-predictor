'use client'

/**
 * Admin Championship team roster management (Phase 9 Plan 03).
 *
 * Table of current-season Championship teams with inline rename + remove,
 * plus an "Add team" input. Duplicate detection is case-insensitive and
 * enforced both client-side (UX) and server-side (authoritative).
 */

import { useState, useTransition } from 'react'
import { Plus, X, Pencil, Check } from 'lucide-react'
import {
  addChampionshipTeam,
  removeChampionshipTeam,
  renameChampionshipTeam,
  type ChampionshipTeamRow,
} from '@/actions/admin/championship'

interface Props {
  season: number
  teams: ChampionshipTeamRow[]
}

function TeamRowItem({
  team,
  season,
  allNames,
}: {
  team: ChampionshipTeamRow
  season: number
  allNames: string[]
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(team.name)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function save() {
    setError(null)
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Name required')
      return
    }
    const lower = trimmed.toLowerCase()
    if (
      allNames.some(
        (n) => n.toLowerCase() === lower && n.toLowerCase() !== team.name.toLowerCase(),
      )
    ) {
      setError('Already in list')
      return
    }
    const fd = new FormData()
    fd.set('id', team.id)
    fd.set('name', trimmed)
    const result = await renameChampionshipTeam(fd)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setEditing(false)
    startTransition(() => window.location.reload())
  }

  async function remove() {
    if (!confirm(`Remove "${team.name}" from the Championship list?`)) return
    const fd = new FormData()
    fd.set('id', team.id)
    const result = await removeChampionshipTeam(fd)
    if ('error' in result) {
      setError(result.error)
      return
    }
    startTransition(() => window.location.reload())
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') {
                setEditing(false)
                setValue(team.name)
                setError(null)
              }
            }}
            className="w-full px-2 py-1 rounded border border-gray-300 text-sm"
            autoFocus
          />
        ) : (
          <span className="text-sm text-gray-900">{team.name}</span>
        )}
        {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
      </div>
      <div className="flex items-center gap-1">
        {editing ? (
          <button
            type="button"
            onClick={save}
            className="p-1.5 rounded hover:bg-green-100 text-green-700"
            aria-label="Save"
          >
            <Check className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="Rename"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          className="p-1.5 rounded hover:bg-red-100 text-red-600"
          aria-label="Remove"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
  void season
}

export function ChampionshipManagement({ season, teams }: Props) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  const allNames = teams.map((t) => t.name)

  async function handleAdd() {
    setError(null)
    const trimmed = newName.trim()
    if (!trimmed) {
      setError('Name required')
      return
    }
    const lower = trimmed.toLowerCase()
    if (allNames.some((n) => n.toLowerCase() === lower)) {
      setError(`"${trimmed}" is already in the list`)
      return
    }
    setBusy(true)
    const fd = new FormData()
    fd.set('name', trimmed)
    fd.set('season', String(season))
    const result = await addChampionshipTeam(fd)
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setNewName('')
    startTransition(() => window.location.reload())
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Championship teams ({season}-{(season + 1).toString().slice(2)})
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          The source list for &ldquo;promoted&rdquo; and &ldquo;playoff winner&rdquo;
          picks. Edit here any time — end-of-season rollover updates this list
          automatically.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="New team name"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || !newName.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}

      {teams.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          No Championship teams for this season yet.
        </p>
      ) : (
        <div className="rounded-xl border border-gray-200 max-h-96 overflow-y-auto">
          {teams.map((t) => (
            <TeamRowItem key={t.id} team={t} season={season} allNames={allNames} />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        {teams.length} team{teams.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
