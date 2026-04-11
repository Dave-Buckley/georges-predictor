import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SecurityQuestionsSetup } from '@/components/admin/security-questions-setup'
import { AdminRecovery } from '@/components/admin/admin-recovery'
import { EmailNotificationToggles } from '@/components/admin/email-notification-toggles'
import type { AdminSettingsRow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/admin/login')
  }

  const georgeEmail = process.env.ADMIN_EMAIL_GEORGE ?? ''
  const daveEmail = process.env.ADMIN_EMAIL_DAVE ?? ''

  // Fetch admin settings (may be null if row doesn't exist yet)
  const adminClient = createAdminClient()
  const { data: adminSettings } = await adminClient
    .from('admin_settings')
    .select('*')
    .eq('admin_user_id', user.id)
    .single()

  const settings = adminSettings as AdminSettingsRow | null

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Set up your security question so the other admin can help you recover
          your account if you lose email access.
        </p>
      </div>

      <div className="space-y-8">
        {/* Security Questions Setup */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">My Security Question</h2>
          <SecurityQuestionsSetup adminUserId={user.id} />
        </section>

        <div className="border-t border-gray-200" />

        {/* Admin Recovery */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Admin Account Recovery</h2>
          <p className="text-gray-500 text-sm mb-4">
            If the other admin loses access to their email, you can reset it here by
            answering their security question.
          </p>
          <AdminRecovery
            currentAdminEmail={user.email ?? ''}
            georgeEmail={georgeEmail}
            daveEmail={daveEmail}
          />
        </section>

        <div className="border-t border-gray-200" />

        {/* Email Notifications */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Email Notifications</h2>
          <p className="text-gray-500 text-sm mb-4">
            Choose which events trigger an email notification to you.
          </p>
          <EmailNotificationToggles
            adminUserId={user.id}
            initialSettings={{
              email_bonus_reminders: settings?.email_bonus_reminders ?? true,
              email_gw_complete: settings?.email_gw_complete ?? true,
              email_prize_triggered: settings?.email_prize_triggered ?? true,
            }}
          />
        </section>
      </div>
    </div>
  )
}
