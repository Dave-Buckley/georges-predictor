'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle, XCircle, Trash2, Mail, Hash, ChevronDown } from 'lucide-react'
import type { MemberRow } from '@/lib/supabase/types'
import {
  approveMember,
  rejectMember,
  removeMember,
  updateMemberEmail,
  setMemberStartingPoints,
} from '@/actions/admin/members'

interface MemberActionsProps {
  member: MemberRow
}

/**
 * Every dialog below is CONTROLLED by MemberActions rather than owning its own
 * open state, and is rendered outside the Actions dropdown.
 *
 * It used to be the other way round — each dialog held its own state and its
 * trigger lived inside the dropdown. But the Actions button closes the dropdown
 * on blur after 200ms, and clicking a menu item blurs it. So the dialog opened,
 * then 200ms later the dropdown unmounted and took the dialog down with it.
 * From George's side the Remove button simply did nothing (July 2026).
 */
interface DialogProps {
  member: MemberRow
  open: boolean
  onOpenChange: (open: boolean) => void
}

function useAction() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const run = (fn: () => Promise<{ success?: boolean; error?: string }>) => {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await fn()
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        // Reload to reflect updated state
        setTimeout(() => window.location.reload(), 800)
      }
    })
  }

  // The dialogs stay mounted now (see DialogProps), so a failed attempt would
  // otherwise still be on screen the next time one is opened.
  const reset = useCallback(() => {
    setError(null)
    setSuccess(false)
  }, [])

  return { isPending, error, success, run, reset }
}

/**
 * Clears a dialog's leftover state each time it opens. Needed because these
 * dialogs are always mounted — they used to be unmounted with the dropdown,
 * which reset them for free.
 */
function useResetOnOpen(open: boolean, reset: () => void) {
  useEffect(() => {
    if (open) reset()
  }, [open, reset])
}

// ─── Approve Button ────────────────────────────────────────────────────────────

function ApproveButton({ memberId }: { memberId: string }) {
  const { isPending, error, run } = useAction()

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(() => approveMember(memberId))}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        <CheckCircle className="w-4 h-4" />
        {isPending ? 'Approving…' : 'Approve'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── Reject Button + Dialog ────────────────────────────────────────────────────

function RejectButton({ member }: { member: MemberRow }) {
  const [open, setOpen] = useState(false)
  const [blockEmail, setBlockEmail] = useState(false)
  const { isPending, error, run } = useAction()

  const handleReject = () => {
    run(() =>
      rejectMember(member.id, blockEmail).then((r) => {
        if (!r.error) setOpen(false)
        return r
      })
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Reject
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-bold text-gray-900 mb-2">
            Reject {member.display_name}?
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 mb-5">
            This will permanently delete their account and send them a rejection email. This cannot be undone.
          </Dialog.Description>

          <label className="flex items-start gap-3 cursor-pointer mb-6">
            <input
              type="checkbox"
              checked={blockEmail}
              onChange={(e) => setBlockEmail(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">
              <strong>Block this email address</strong> to prevent{' '}
              <span className="text-gray-500">{member.email}</span> from signing up again
            </span>
          </label>

          {error && (
            <p className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
          )}

          <div className="flex gap-3 justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={isPending}
              onClick={handleReject}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {isPending ? 'Rejecting…' : 'Yes, reject'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Remove Dialog ─────────────────────────────────────────────────────────────

function RemoveDialog({ member, open, onOpenChange }: DialogProps) {
  const { isPending, error, run, reset } = useAction()
  useResetOnOpen(open, reset)

  const handleRemove = () => {
    run(() =>
      removeMember(member.id).then((r) => {
        if (!r.error) onOpenChange(false)
        return r
      })
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-bold text-gray-900 mb-2">
            Remove {member.display_name}?
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 mb-4">
            This removes <strong>{member.display_name}</strong> from the
            competition and the league tables, and deletes their account. They
            can sign up again later with the same email.
          </Dialog.Description>

          <p className="text-sm text-gray-600 mb-6 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            Their full history — points, predictions, pre-season picks and
            prizes — is saved to the archive first and kept for at least 10
            years.
          </p>

          {error && (
            <p className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
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
              disabled={isPending}
              onClick={handleRemove}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60"
            >
              {isPending ? 'Removing…' : 'Yes, remove'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Edit Email Dialog ─────────────────────────────────────────────────────────

function EditEmailDialog({ member, open, onOpenChange }: DialogProps) {
  const [newEmail, setNewEmail] = useState(member.email)
  const { isPending, error, run, reset } = useAction()

  // Re-seed the field from the member each time the dialog opens, so an
  // abandoned edit is not still sitting there next time it is opened.
  const resetForm = useCallback(() => {
    reset()
    setNewEmail(member.email)
  }, [reset, member.email])
  useResetOnOpen(open, resetForm)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    run(() =>
      updateMemberEmail(member.id, newEmail).then((r) => {
        if (!r.error) onOpenChange(false)
        return r
      })
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-bold text-gray-900 mb-1">
            Edit email — {member.display_name}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 mb-5">
            Update this member&apos;s email address. They will use the new email to log in.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-email" className="block text-sm font-medium text-gray-700 mb-1">
                New email address
              </label>
              <input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {error && (
              <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-60"
              >
                {isPending ? 'Saving…' : 'Save email'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Set Starting Points Dialog ────────────────────────────────────────────────

function SetStartingPointsDialog({ member, open, onOpenChange }: DialogProps) {
  const [points, setPoints] = useState(String(member.starting_points))
  const { isPending, error, run, reset } = useAction()

  const resetForm = useCallback(() => {
    reset()
    setPoints(String(member.starting_points))
  }, [reset, member.starting_points])
  useResetOnOpen(open, resetForm)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numPoints = parseInt(points, 10)
    if (isNaN(numPoints) || numPoints < 0) return
    run(() =>
      setMemberStartingPoints(member.id, numPoints).then((r) => {
        if (!r.error) onOpenChange(false)
        return r
      })
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-bold text-gray-900 mb-1">
            Starting points — {member.display_name}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 mb-5">
            Set the starting points for this member. Use this for mid-season joiners.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="starting-points" className="block text-sm font-medium text-gray-700 mb-1">
                Starting points
              </label>
              <input
                id="starting-points"
                type="number"
                min="0"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {error && (
              <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-60"
              >
                {isPending ? 'Saving…' : 'Save points'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Main MemberActions Component ─────────────────────────────────────────────

type ActiveDialog = 'email' | 'points' | 'remove' | null

export function MemberActions({ member }: MemberActionsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const isPending = member.approval_status === 'pending'

  if (isPending) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <ApproveButton memberId={member.id} />
        <RejectButton member={member} />
      </div>
    )
  }

  // Close the menu and open the chosen dialog. The dialogs are rendered below,
  // OUTSIDE the dropdown, so closing the menu cannot unmount them.
  const openDialog = (which: Exclude<ActiveDialog, null>) => {
    setDropdownOpen(false)
    setActiveDialog(which)
  }

  const closeDialog = (open: boolean) => {
    if (!open) setActiveDialog(null)
  }

  // Approved / other status — show dropdown
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        Actions
        <ChevronDown className="w-4 h-4" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10">
          <button
            type="button"
            onClick={() => openDialog('email')}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Mail className="w-4 h-4" />
            Edit email
          </button>
          <button
            type="button"
            onClick={() => openDialog('points')}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Hash className="w-4 h-4" />
            Set starting points
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={() => openDialog('remove')}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Remove member
          </button>
        </div>
      )}

      <EditEmailDialog
        member={member}
        open={activeDialog === 'email'}
        onOpenChange={closeDialog}
      />
      <SetStartingPointsDialog
        member={member}
        open={activeDialog === 'points'}
        onOpenChange={closeDialog}
      />
      <RemoveDialog
        member={member}
        open={activeDialog === 'remove'}
        onOpenChange={closeDialog}
      />
    </div>
  )
}

// ─── Add Member Dialog (exported for page use) ─────────────────────────────────

import { addMember } from '@/actions/admin/members'

export function AddMemberDialog() {
  const [open, setOpen] = useState(false)
  const { isPending, error, run } = useAction()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    run(() =>
      addMember(formData).then((r) => {
        if (!r.error) {
          setOpen(false)
          ;(e.target as HTMLFormElement).reset()
        }
        return r
      })
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          + Add member
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
          <Dialog.Title className="text-lg font-bold text-gray-900 mb-1">
            Add a member manually
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-500 mb-5">
            Add a member directly — they will receive a welcome email with a login link. Use this for late joiners or when managing access manually.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="add-name" className="block text-sm font-medium text-gray-700 mb-1">
                Display name
              </label>
              <input
                id="add-name"
                name="display_name"
                type="text"
                required
                maxLength={50}
                placeholder="e.g. Big Steve"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="add-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="add-email"
                name="email"
                type="email"
                required
                placeholder="steve@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="add-points" className="block text-sm font-medium text-gray-700 mb-1">
                Starting points
              </label>
              <input
                id="add-points"
                name="starting_points"
                type="number"
                min="0"
                defaultValue="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="mt-1 text-xs text-gray-400">Use 0 for new members joining at the start.</p>
            </div>

            {error && (
              <p className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</p>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-60"
              >
                {isPending ? 'Adding…' : 'Add member'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
