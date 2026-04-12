/**
 * Group weekly email body — friendly, short, links to standings +
 * gameweek detail page. Attached PDF contains full breakdown.
 */
import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'

import { EmailLayout } from './_shared/Layout'

interface Props {
  gwNumber: number
  standingsLink: string
  gameweekLink: string
}

export default function GroupWeeklyEmail({
  gwNumber,
  standingsLink,
  gameweekLink,
}: Props) {
  return (
    <EmailLayout previewText={`GW ${gwNumber} is in the books!`}>
      <Section>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>
          Gameweek {gwNumber} is in the books.
        </Text>
        <Text>
          Standings, top scorers, H2H steals, and a full breakdown are in the
          attached PDF.
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
          View GW {gwNumber} details
        </Button>
      </Section>
      <Section style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 12 }}>
          Full standings: <a href={standingsLink}>{standingsLink}</a>
        </Text>
      </Section>
    </EmailLayout>
  )
}
