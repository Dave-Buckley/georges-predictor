import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server component that renders the unread notification count badge.
 * Fetches directly from admin_notifications table using admin client.
 */
export async function NotificationBadge() {
  try {
    const supabase = createAdminClient()
    const { count } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)

    if (!count || count === 0) return null

    return (
      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold leading-none">
        {count > 99 ? '99+' : count}
      </span>
    )
  } catch {
    // Fail silently — badge is non-critical
    return null
  }
}
