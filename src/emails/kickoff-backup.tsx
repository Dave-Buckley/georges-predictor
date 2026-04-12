/**
 * Kickoff backup email — admin-only, disaster-recovery framing.
 * Sent at the moment of first-fixture kickoff.
 */
import * as React from 'react'
import { Section, Text } from '@react-email/components'

import { EmailLayout } from './_shared/Layout'

interface Props {
  gwNumber: number
  memberCount: number
  kickoffIso: string
}

export default function KickoffBackupEmail({
  gwNumber,
  memberCount,
  kickoffIso,
}: Props) {
  return (
    <EmailLayout
      previewText={`GW ${gwNumber} kickoff backup — ${memberCount} members locked in`}
    >
      <Section>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>
          GW {gwNumber} — Kickoff Backup
        </Text>
        <Text>
          All predictions, LOS picks, and bonus picks have been locked as of
          the first fixture kickoff at{' '}
          <strong>{new Date(kickoffIso).toUTCString()}</strong>. This email
          covers <strong>{memberCount} members</strong>.
        </Text>
        <Text>
          Both attachments (PDF + XLSX) contain everything needed to run GW{' '}
          {gwNumber} manually if the site goes down.
        </Text>
      </Section>
    </EmailLayout>
  )
}
