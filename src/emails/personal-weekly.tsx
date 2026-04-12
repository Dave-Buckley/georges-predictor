/**
 * Personal weekly email body — greets by name, summarises the week's
 * points and rank, links to the gameweek detail page.
 */
import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import { EmailLayout } from './_shared/Layout'

interface Props {
  displayName: string
  gwNumber: number
  weeklyPoints: number
  rank: number
  totalMembers: number
  gameweekLink: string
}

export default function PersonalWeeklyEmail({
  displayName,
  gwNumber,
  weeklyPoints,
  rank,
  totalMembers,
  gameweekLink,
}: Props) {
  return (
    <EmailLayout previewText={`${displayName} — your GW ${gwNumber} summary`}>
      <Section>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>Hi {displayName},</Text>
        <Text>
          You scored <strong>{weeklyPoints} points</strong> in Gameweek{' '}
          {gwNumber}. You are currently ranked{' '}
          <strong>
            {rank} / {totalMembers}
          </strong>
          .
        </Text>
        <Text>
          See the full breakdown in the attached PDF — every prediction, every
          result, bonus status, and LOS outcome.
        </Text>
      </Section>
      <Section style={{ marginTop: 16 }}>
        <Button
          href={gameweekLink}
          style={{
            backgroundColor: '#2563eb',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 6,
            textDecoration: 'none',
          }}
        >
          View GW {gwNumber}
        </Button>
      </Section>
    </EmailLayout>
  )
}
