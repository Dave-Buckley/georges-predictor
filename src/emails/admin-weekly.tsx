/**
 * Admin weekly email body — targeted at George + Dave. Heavier on data
 * density, mentions the attached admin XLSX.
 */
import * as React from 'react'
import { Section, Text } from '@react-email/components'

import { EmailLayout } from './_shared/Layout'

interface Props {
  gwNumber: number
  standingsSummary: string
  doubleBubbleActive: boolean
}

export default function AdminWeeklyEmail({
  gwNumber,
  standingsSummary,
  doubleBubbleActive,
}: Props) {
  return (
    <EmailLayout previewText={`GW ${gwNumber} admin summary`}>
      <Section>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>
          GW {gwNumber} — Admin summary
        </Text>
        {doubleBubbleActive ? (
          <Text style={{ color: '#b45309', fontWeight: 600 }}>
            Double Bubble was active this week.
          </Text>
        ) : null}
        <Text>{standingsSummary}</Text>
        <Text>
          Full workbook attached — Standings, Predictions, Scores, Bonuses,
          LOS, H2H. Double-check any fixture scores that look off and edit from
          the admin panel if needed.
        </Text>
      </Section>
    </EmailLayout>
  )
}
