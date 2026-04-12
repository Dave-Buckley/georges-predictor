/**
 * Member /profile page — shows account info (read-only) and the per-member
 * weekly email opt-out toggles.
 *
 * The member row is resolved via the session client; RLS ensures a member
 * can only read their own row.
 */
import { redirect } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { MemberRow } from '@/lib/supabase/types'

import { EmailPreferenceToggles } from './_components/email-preference-toggles'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Middleware normally catches this; defence in depth.
    redirect('/login')
  }

  const { data: memberRaw, error } = await supabase
    .from('members')
    .select(
      'display_name, email, email_weekly_personal, email_weekly_group',
    )
    .eq('user_id', user.id)
    .single()

  if (error || !memberRaw) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-slate-400 mt-2">
          We couldn&apos;t find your member record. Please contact George for help.
        </p>
      </div>
    )
  }

  const member = memberRaw as Pick<
    MemberRow,
    'display_name' | 'email' | 'email_weekly_personal' | 'email_weekly_group'
  >

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-slate-400 text-sm mt-1">
          Your account information and email preferences.
        </p>
      </header>

      {/* ── Account info (read-only) ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Account
        </h2>
        <div className="rounded-2xl border border-slate-700 bg-slate-900 divide-y divide-slate-800">
          <div className="px-5 py-4 flex items-center justify-between">
            <span className="text-sm text-slate-400">Display name</span>
            <span className="text-sm text-white font-medium">
              {member.display_name}
            </span>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <span className="text-sm text-slate-400">Email</span>
            <span className="text-sm text-white font-medium">
              {member.email}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          To change your display name or email, please contact George.
        </p>
      </section>

      {/* ── Email preferences ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Email preferences
        </h2>
        <EmailPreferenceToggles
          initial={{
            email_weekly_personal: member.email_weekly_personal ?? true,
            email_weekly_group: member.email_weekly_group ?? true,
          }}
        />
      </section>
    </div>
  )
}
