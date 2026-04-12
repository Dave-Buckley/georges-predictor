/**
 * React Email render smoke tests — ensures every template imports cleanly
 * and produces valid HTML via @react-email/components `render()`.
 */
import { describe, expect, it } from 'vitest'
import React from 'react'
import { render } from '@react-email/components'

import { EmailLayout } from '@/emails/_shared/Layout'
import GroupWeeklyEmail from '@/emails/group-weekly'
import PersonalWeeklyEmail from '@/emails/personal-weekly'
import AdminWeeklyEmail from '@/emails/admin-weekly'
import KickoffBackupEmail from '@/emails/kickoff-backup'

// React injects empty HTML comments (<!-- -->) between adjacent text nodes;
// strip them so assertions can match human-readable substrings.
const stripReactComments = (s: string): string =>
  s.replace(/<!--\s*-->/g, '').replace(/<!--[^>]*-->/g, '')

describe('email templates', () => {
  it('EmailLayout renders children + header', async () => {
    const html = await render(
      <EmailLayout previewText="test">
        <p>hello</p>
      </EmailLayout>,
    )
    expect(html).toContain("George")
    expect(html).toContain('hello')
  })

  it('GroupWeeklyEmail renders gwNumber and links', async () => {
    const html = stripReactComments(
      await render(
        <GroupWeeklyEmail
          gwNumber={7}
          standingsLink="https://example.com/standings"
          gameweekLink="https://example.com/gameweeks/7"
        />,
      ),
    )
    expect(html).toContain('Gameweek 7')
    expect(html).toContain('/standings')
    expect(html).toContain('/gameweeks/7')
  })

  it('PersonalWeeklyEmail greets the member by displayName', async () => {
    const html = stripReactComments(
      await render(
        <PersonalWeeklyEmail
          displayName="Alice"
          gwNumber={3}
          weeklyPoints={40}
          rank={2}
          totalMembers={50}
          gameweekLink="https://example.com/gameweeks/3"
        />,
      ),
    )
    expect(html).toContain('Alice')
    expect(html).toContain('40')
    expect(html).toMatch(/2\s*\/\s*50/)
  })

  it('AdminWeeklyEmail surfaces Double Bubble banner when active', async () => {
    const html = await render(
      <AdminWeeklyEmail
        gwNumber={5}
        standingsSummary="Member A leads on 120."
        doubleBubbleActive={true}
      />,
    )
    expect(html).toContain('Double Bubble')
    expect(html).toContain('Member A leads')
  })

  it('KickoffBackupEmail carries disaster-recovery framing', async () => {
    const html = await render(
      <KickoffBackupEmail
        gwNumber={1}
        memberCount={42}
        kickoffIso="2025-08-16T14:00:00Z"
      />,
    )
    expect(html).toContain('Kickoff Backup')
    expect(html).toContain('42')
    expect(html).toMatch(/site goes down|manually/i)
  })
})
