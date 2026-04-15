/**
 * Admin weekly email body — targeted at George + Dave. Renders a full
 * in-email breakdown (headline, top scorer, top 3 weekly, full league
 * table, fun facts) on top of the attached admin XLSX for deeper dives.
 */
import * as React from 'react'
import { Section, Text, Hr } from '@react-email/components'

import { EmailLayout } from './_shared/Layout'

export interface AdminWeeklyStanding {
  rank: number
  displayName: string
  totalPoints: number
  weeklyPoints: number
}

export interface AdminWeeklyTopWeekly {
  displayName: string
  weeklyPoints: number
}

export interface AdminWeeklyProps {
  gwNumber: number
  doubleBubbleActive: boolean
  topWeekly: AdminWeeklyTopWeekly[]
  standings: AdminWeeklyStanding[]
  totalWeeklyPoints: number
  participantCount: number
  avgWeeklyPoints: number
  zeroPointCount: number
  biggestMover: {
    displayName: string
    weeklyPoints: number
  } | null
}

function formatPts(n: number): string {
  return `${n} pt${n === 1 ? '' : 's'}`
}

export default function AdminWeeklyEmail({
  gwNumber,
  doubleBubbleActive,
  topWeekly,
  standings,
  totalWeeklyPoints,
  participantCount,
  avgWeeklyPoints,
  zeroPointCount,
  biggestMover,
}: AdminWeeklyProps) {
  const headline = topWeekly[0]
  return (
    <EmailLayout previewText={`GW ${gwNumber} — full breakdown`}>
      <Section>
        <Text style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          GW {gwNumber} — Weekly breakdown
        </Text>
        {doubleBubbleActive ? (
          <Text
            style={{
              color: '#b45309',
              fontWeight: 600,
              fontSize: 13,
              marginTop: 4,
            }}
          >
            Double Bubble was active — weekly points ×2.
          </Text>
        ) : null}
      </Section>

      {headline ? (
        <Section
          style={{
            backgroundColor: '#f3e8ff',
            padding: 16,
            borderRadius: 6,
            marginTop: 12,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: '#6b21a8',
              textTransform: 'uppercase',
              letterSpacing: 1,
              margin: 0,
            }}
          >
            Highest performer
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#4c1d95',
              margin: '4px 0 0',
            }}
          >
            {headline.displayName} — {formatPts(headline.weeklyPoints)}
          </Text>
        </Section>
      ) : null}

      <Hr style={{ margin: '20px 0', borderColor: '#e5e7eb' }} />

      <Section>
        <Text style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
          Top 3 this week
        </Text>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: 8,
            fontSize: 14,
          }}
        >
          <tbody>
            {topWeekly.map((t, i) => (
              <tr key={`${t.displayName}-${i}`}>
                <td style={{ padding: '4px 0', width: 28, color: '#6b7280' }}>
                  {i + 1}.
                </td>
                <td style={{ padding: '4px 0' }}>{t.displayName}</td>
                <td
                  style={{
                    padding: '4px 0',
                    textAlign: 'right',
                    fontWeight: 600,
                  }}
                >
                  {formatPts(t.weeklyPoints)}
                </td>
              </tr>
            ))}
            {topWeekly.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ color: '#6b7280', padding: '4px 0' }}>
                  No predictions scored this week.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Section>

      <Hr style={{ margin: '20px 0', borderColor: '#e5e7eb' }} />

      <Section>
        <Text style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
          Fun facts
        </Text>
        <ul style={{ paddingLeft: 18, margin: '8px 0', fontSize: 13 }}>
          <li>
            <strong>{formatPts(totalWeeklyPoints)}</strong> scored across{' '}
            {participantCount} player{participantCount === 1 ? '' : 's'}.
          </li>
          <li>
            Average weekly score:{' '}
            <strong>{avgWeeklyPoints.toFixed(1)} pts</strong>.
          </li>
          <li>
            {zeroPointCount}{' '}
            {zeroPointCount === 1 ? 'player' : 'players'} blanked this week.
          </li>
          {biggestMover ? (
            <li>
              Biggest single week:{' '}
              <strong>
                {biggestMover.displayName} ({formatPts(biggestMover.weeklyPoints)})
              </strong>
              .
            </li>
          ) : null}
        </ul>
      </Section>

      <Hr style={{ margin: '20px 0', borderColor: '#e5e7eb' }} />

      <Section>
        <Text style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
          Current league table
        </Text>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: 8,
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 0',
                  width: 32,
                  color: '#6b7280',
                  fontWeight: 600,
                }}
              >
                #
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '6px 0',
                  color: '#6b7280',
                  fontWeight: 600,
                }}
              >
                Member
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '6px 0',
                  color: '#6b7280',
                  fontWeight: 600,
                }}
              >
                Week
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '6px 0',
                  color: '#6b7280',
                  fontWeight: 600,
                }}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr
                key={s.displayName + s.rank}
                style={{ borderBottom: '1px solid #f3f4f6' }}
              >
                <td style={{ padding: '6px 0', color: '#6b7280' }}>
                  {s.rank}
                </td>
                <td style={{ padding: '6px 0' }}>{s.displayName}</td>
                <td style={{ padding: '6px 0', textAlign: 'right' }}>
                  {s.weeklyPoints}
                </td>
                <td
                  style={{
                    padding: '6px 0',
                    textAlign: 'right',
                    fontWeight: 600,
                  }}
                >
                  {s.totalPoints}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section>
        <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 16 }}>
          Full admin workbook attached — predictions, bonuses, LOS, H2H.
          Double-check any fixture scores that look off and edit from the admin
          panel if needed.
        </Text>
      </Section>
    </EmailLayout>
  )
}
