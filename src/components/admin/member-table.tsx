'use client'

import { useState } from 'react'
import type { MemberRow } from '@/lib/supabase/types'
import { MemberActions } from './member-actions'
import { MemberLink } from '@/components/shared/member-link'

type FilterTab = 'all' | 'pending' | 'approved'

interface MemberTableProps {
  members: MemberRow[]
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-800 border border-amber-300',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-100 text-green-800 border border-green-300',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 border border-red-300',
  },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function MemberTable({ members }: MemberTableProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [sortField, setSortField] = useState<'display_name' | 'created_at'>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const filtered = members
    .filter((m) => {
      if (activeFilter === 'pending') return m.approval_status === 'pending'
      if (activeFilter === 'approved') return m.approval_status === 'approved'
      return true
    })
    .sort((a, b) => {
      const valA = a[sortField] ?? ''
      const valB = b[sortField] ?? ''
      const cmp = valA.localeCompare(valB)
      return sortDir === 'asc' ? cmp : -cmp
    })

  const pendingCount = members.filter((m) => m.approval_status === 'pending').length
  const approvedCount = members.filter((m) => m.approval_status === 'approved').length

  const toggleSort = (field: 'display_name' | 'created_at') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: 'display_name' | 'created_at' }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-gray-600 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(
          [
            { key: 'all', label: `All (${members.length})` },
            { key: 'pending', label: `Pending (${pendingCount})` },
            { key: 'approved', label: `Approved (${approvedCount})` },
          ] as { key: FilterTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveFilter(key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeFilter === key
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No members found</p>
          {activeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="mt-2 text-sm text-purple-600 hover:underline"
            >
              Show all members
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => toggleSort('display_name')}
                >
                  Name <SortIcon field="display_name" />
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  Starting Pts
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                  onClick={() => toggleSort('created_at')}
                >
                  Joined <SortIcon field="created_at" />
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map((member) => {
                const badge = STATUS_BADGE[member.approval_status] ?? STATUS_BADGE.pending
                return (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <MemberLink displayName={member.display_name} className="font-semibold text-gray-900" />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{member.email}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                      {member.starting_points}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(member.created_at)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <MemberActions member={member} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
