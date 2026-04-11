'use client'

import { useState, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'
import { addFixture, editFixture } from '@/actions/admin/fixtures'
import type { FixtureWithTeams, TeamRow, GameweekRow } from '@/lib/supabase/types'

interface FixtureFormProps {
  mode: 'add' | 'edit'
  fixture?: FixtureWithTeams
  teams: TeamRow[]
  gameweeks: GameweekRow[]
  defaultGameweekNumber?: number
  onClose: () => void
  onSuccess?: () => void
}

// Convert UTC ISO string to local datetime-local input value
function toDatetimeLocal(utcString: string): string {
  const date = new Date(utcString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Convert datetime-local value to UTC ISO string
function fromDatetimeLocal(localString: string): string {
  return new Date(localString).toISOString()
}

export function FixtureForm({
  mode,
  fixture,
  teams,
  gameweeks,
  defaultGameweekNumber,
  onClose,
  onSuccess,
}: FixtureFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [adminOverride, setAdminOverride] = useState(false)
  const [formValues, setFormValues] = useState({
    home_team_id: fixture?.home_team_id ?? '',
    away_team_id: fixture?.away_team_id ?? '',
    kickoff_time: fixture ? toDatetimeLocal(fixture.kickoff_time) : '',
    gameweek_number: String(
      defaultGameweekNumber ?? fixture?.gameweek?.number ?? (gameweeks[0]?.number ?? 1)
    ),
    status: fixture?.status ?? 'SCHEDULED',
    home_score: fixture?.home_score != null ? String(fixture.home_score) : '',
    away_score: fixture?.away_score != null ? String(fixture.away_score) : '',
  })

  const hasKickedOff = fixture
    ? new Date() >= new Date(fixture.kickoff_time)
    : false

  const sameTeamError =
    formValues.home_team_id &&
    formValues.away_team_id &&
    formValues.home_team_id === formValues.away_team_id

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (sameTeamError) return
    setConfirmOpen(true)
  }

  const handleConfirm = () => {
    setError(null)
    setConfirmOpen(false)

    startTransition(async () => {
      const formData = new FormData()

      if (mode === 'add') {
        formData.set('home_team_id', formValues.home_team_id)
        formData.set('away_team_id', formValues.away_team_id)
        formData.set('kickoff_time', fromDatetimeLocal(formValues.kickoff_time))
        formData.set('gameweek_number', formValues.gameweek_number)
        const result = await addFixture(formData)
        if (result.error) {
          setError(result.error)
        } else {
          onSuccess?.()
          onClose()
          window.location.reload()
        }
      } else if (fixture) {
        formData.set('fixture_id', fixture.id)
        if (!hasKickedOff || adminOverride) {
          if (formValues.kickoff_time) {
            formData.set('kickoff_time', fromDatetimeLocal(formValues.kickoff_time))
          }
        }
        if (formValues.status) {
          formData.set('status', formValues.status)
        }
        if (formValues.home_score !== '') {
          formData.set('home_score', formValues.home_score)
        }
        if (formValues.away_score !== '') {
          formData.set('away_score', formValues.away_score)
        }
        if (adminOverride) {
          formData.set('admin_override', 'true')
        }
        const result = await editFixture(formData)
        if (result.error) {
          setError(result.error)
        } else {
          onSuccess?.()
          onClose()
          window.location.reload()
        }
      }
    })
  }

  const STATUSES = [
    'SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED',
    'FINISHED', 'POSTPONED', 'SUSPENDED', 'CANCELLED', 'AWARDED',
  ] as const

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'add' ? (
          <>
            {/* Home Team */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Home Team
              </label>
              <select
                required
                value={formValues.home_team_id}
                onChange={(e) => setFormValues((v) => ({ ...v, home_team_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select home team…</option>
                {sortedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Away Team */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Away Team
              </label>
              <select
                required
                value={formValues.away_team_id}
                onChange={(e) => setFormValues((v) => ({ ...v, away_team_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select away team…</option>
                {sortedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {sameTeamError && (
                <p className="mt-1 text-xs text-red-600">Home and away teams must be different.</p>
              )}
            </div>

            {/* Gameweek */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gameweek
              </label>
              <select
                required
                value={formValues.gameweek_number}
                onChange={(e) => setFormValues((v) => ({ ...v, gameweek_number: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {gameweeks.map((gw) => (
                  <option key={gw.id} value={String(gw.number)}>
                    Gameweek {gw.number}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            {/* Teams display (read-only in edit mode) */}
            {fixture && (
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <p className="font-medium text-gray-700">
                  {fixture.home_team.name} vs {fixture.away_team.name}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Gameweek {fixture.gameweek.number}
                </p>
              </div>
            )}
          </>
        )}

        {/* Kick-off time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kick-off time
          </label>
          {hasKickedOff && !adminOverride ? (
            <div>
              <p className="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm border border-gray-200">
                {fixture ? new Date(fixture.kickoff_time).toLocaleString('en-GB') : '—'}
                <span className="ml-2 text-xs text-gray-400">(locked — match kicked off)</span>
              </p>
            </div>
          ) : (
            <input
              type="datetime-local"
              required={mode === 'add'}
              value={formValues.kickoff_time}
              onChange={(e) => setFormValues((v) => ({ ...v, kickoff_time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          )}
        </div>

        {/* Edit-mode: Status */}
        {mode === 'edit' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formValues.status}
              onChange={(e) => setFormValues((v) => ({ ...v, status: e.target.value as import('@/lib/supabase/types').FixtureStatus }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Edit-mode: Scores (always editable) */}
        {mode === 'edit' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Home Score
              </label>
              <input
                type="number"
                min="0"
                value={formValues.home_score}
                onChange={(e) => setFormValues((v) => ({ ...v, home_score: e.target.value }))}
                placeholder="—"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Away Score
              </label>
              <input
                type="number"
                min="0"
                value={formValues.away_score}
                onChange={(e) => setFormValues((v) => ({ ...v, away_score: e.target.value }))}
                placeholder="—"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        )}

        {/* Admin override toggle (edit mode, after kickoff) */}
        {mode === 'edit' && hasKickedOff && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={adminOverride}
                onChange={(e) => setAdminOverride(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-amber-900">
                  Admin Override
                </span>
                <p className="text-xs text-amber-700 mt-0.5">
                  This fixture has already kicked off. Editing the kick-off time requires admin override.
                  Only use this to correct a data entry mistake.
                </p>
              </div>
            </label>
          </div>
        )}

        {error && (
          <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !!sameTeamError}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-60"
          >
            {isPending ? 'Saving…' : mode === 'add' ? 'Add fixture' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Confirmation dialog */}
      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <Dialog.Title className="text-base font-bold text-gray-900 mb-2">
              {mode === 'add' ? 'Add this fixture?' : 'Save changes?'}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-600 mb-5">
              {adminOverride
                ? 'You are using admin override to edit a fixture after kick-off. Are you sure?'
                : mode === 'add'
                  ? 'This fixture will be added to the gameweek.'
                  : 'Your changes will be applied to this fixture.'}
            </Dialog.Description>
            {adminOverride && (
              <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Admin override is enabled. This will edit a kicked-off fixture.
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
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
                onClick={handleConfirm}
                disabled={isPending}
                className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 ${
                  adminOverride
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isPending ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

// ─── Fixture Dialog (modal wrapper for FixtureForm) ───────────────────────────

interface FixtureDialogProps {
  mode: 'add' | 'edit'
  fixture?: FixtureWithTeams
  teams: TeamRow[]
  gameweeks: GameweekRow[]
  defaultGameweekNumber?: number
  trigger: React.ReactNode
}

export function FixtureDialog({
  mode,
  fixture,
  teams,
  gameweeks,
  defaultGameweekNumber,
  trigger,
}: FixtureDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-lg font-bold text-gray-900">
              {mode === 'add' ? 'Add fixture' : 'Edit fixture'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            {mode === 'add' ? 'Add a new fixture to a gameweek' : 'Edit fixture details'}
          </Dialog.Description>

          <FixtureForm
            mode={mode}
            fixture={fixture}
            teams={teams}
            gameweeks={gameweeks}
            defaultGameweekNumber={defaultGameweekNumber}
            onClose={() => setOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
