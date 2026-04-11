'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Trophy,
  Settings,
  Bell,
  Calendar,
  Star,
  BarChart3,
  Menu,
  X,
} from 'lucide-react'

interface SidebarProps {
  adminEmail?: string
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
  badge?: React.ReactNode
}

export function AdminSidebar({ adminEmail }: SidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const navItems: NavItem[] = [
    {
      href: '/admin',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/admin/members',
      label: 'Members',
      icon: Users,
    },
    {
      href: '/admin/predictions',
      label: 'All Predictions',
      icon: Trophy,
    },
    {
      href: '/admin/notifications',
      label: 'Notifications',
      icon: Bell,
    },
    {
      href: '/admin/gameweeks',
      label: 'Gameweeks',
      icon: Calendar,
    },
    {
      href: '/admin/bonuses',
      label: 'Bonuses',
      icon: Star,
      disabled: true,
    },
    {
      href: '/admin/reports',
      label: 'Reports',
      icon: BarChart3,
      disabled: true,
    },
    {
      href: '/admin/settings',
      label: 'Settings',
      icon: Settings,
    },
  ]

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-lg font-bold text-white tracking-tight">
          George&apos;s Predictor
        </h1>
        <p className="text-xs text-white/50 mt-0.5">Admin Panel</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/30 cursor-not-allowed select-none"
                title={`${item.label} — Coming soon`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
                <span className="ml-auto text-xs text-white/20 hidden lg:inline">Soon</span>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                active
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
              {item.badge && <span className="ml-auto">{item.badge}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Admin info at bottom */}
      {adminEmail && (
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-xs text-white/40 truncate">{adminEmail}</p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 bg-gray-900 min-h-screen flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile: hamburger button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-gray-900 text-white shadow-md"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile: drawer overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative w-64 bg-gray-900 h-full shadow-2xl">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
