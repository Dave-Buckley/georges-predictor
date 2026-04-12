/**
 * Personal weekly PDF renderer.
 *
 * Pure: one member's view of their GW performance. Throws if member not in
 * standings (contract enforced — no silent empty PDFs).
 */
import 'server-only'
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

import type { GameweekReportData } from './_data/gather-gameweek-data'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://georges-predictor.vercel.app'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#555', marginBottom: 12 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  fixtureRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '1px solid #eee',
  },
  fixtureLabel: { flex: 2 },
  fixtureCell: { flex: 1, textAlign: 'center' },
  pointsBadge: { width: 60, textAlign: 'right', fontWeight: 700 },
  bonusStar: { width: 20, textAlign: 'center' },
  callout: {
    backgroundColor: '#dbeafe',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  cta: {
    backgroundColor: '#2563eb',
    color: '#fff',
    padding: 10,
    borderRadius: 4,
    marginTop: 12,
    textAlign: 'center',
  },
  link: { color: '#fff', textDecoration: 'none' },
})

interface Props {
  data: GameweekReportData
  memberId: string
}

export function PersonalWeeklyReport({ data, memberId }: Props) {
  const member = data.standings.find((m) => m.memberId === memberId)
  if (!member) {
    throw new Error(`Member ${memberId} not found in gameweek data`)
  }

  const predictions = data.predictionsByMember[memberId] ?? []
  const fixturesById = new Map(data.fixtures.map((f) => [f.id, f]))
  const memberLos = data.losStatus.find((l) => l.memberId === memberId)
  const memberH2h = data.h2hSteals.filter((s) =>
    s.memberIds.includes(memberId),
  )
  const totalMembers = data.standings.length
  const gameweekLink = `${APP_URL}/gameweeks/${data.gwNumber}`
  const memberBonusPick = data.bonus.pickByMember[memberId]

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>{member.displayName}</Text>
        <Text style={styles.subtitle}>
          GW {data.gwNumber} — {member.weeklyPoints} points this week • Rank{' '}
          {member.rank} / {totalMembers} • Season total {member.totalPoints}
        </Text>

        {/* Per-fixture rows */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your predictions</Text>
          <View style={styles.fixtureRow}>
            <Text style={styles.fixtureLabel}>Fixture</Text>
            <Text style={styles.fixtureCell}>Prediction</Text>
            <Text style={styles.fixtureCell}>Actual</Text>
            <Text style={styles.bonusStar}>★</Text>
            <Text style={styles.pointsBadge}>Pts</Text>
          </View>
          {predictions.map((p) => {
            const f = fixturesById.get(p.fixtureId)
            if (!f) return null
            const actual =
              f.homeScore != null && f.awayScore != null
                ? `${f.homeScore} - ${f.awayScore}`
                : '—'
            return (
              <View key={p.fixtureId} style={styles.fixtureRow}>
                <Text style={styles.fixtureLabel}>
                  {f.home} vs {f.away}
                </Text>
                <Text style={styles.fixtureCell}>
                  {p.homePrediction} - {p.awayPrediction}
                </Text>
                <Text style={styles.fixtureCell}>{actual}</Text>
                <Text style={styles.bonusStar}>
                  {p.isBonusFixture ? 'bonus★' : ''}
                </Text>
                <Text style={styles.pointsBadge}>{p.pointsAwarded}</Text>
              </View>
            )
          })}
        </View>

        {/* Bonus summary */}
        {memberBonusPick?.fixtureId ? (
          <View style={styles.section}>
            <Text>
              Bonus pick: fixture {memberBonusPick.fixtureId} —{' '}
              {memberBonusPick.awarded === true
                ? 'awarded'
                : memberBonusPick.awarded === false
                  ? 'rejected'
                  : 'pending'}
            </Text>
          </View>
        ) : null}

        {/* LOS */}
        {memberLos && memberLos.teamPicked ? (
          <View style={styles.section}>
            <Text>
              Last One Standing: {memberLos.teamPicked} —{' '}
              {memberLos.eliminated
                ? 'ELIMINATED'
                : memberLos.survived === true
                  ? 'survived'
                  : memberLos.survived === false
                    ? 'knocked out this week'
                    : 'pending'}
            </Text>
          </View>
        ) : null}

        {/* H2H callout */}
        {memberH2h.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>H2H Steal</Text>
            {memberH2h.map((s, i) => {
              const others = s.memberIds
                .filter((id) => id !== memberId)
                .map(
                  (id) =>
                    data.standings.find((m) => m.memberId === id)
                      ?.displayName ?? id,
                )
                .join(', ')
              const status = s.resolvedAt
                ? 'resolved'
                : s.resolvesInGwId
                  ? 'resolving next week'
                  : 'detected'
              return (
                <View key={i} style={styles.callout}>
                  <Text>
                    Tied with {others} at position {s.position} ({status})
                  </Text>
                </View>
              )
            })}
          </View>
        ) : null}

        {/* CTA */}
        <Link src={gameweekLink} style={styles.link}>
          <View style={styles.cta}>
            <Text>View full details</Text>
          </View>
        </Link>
      </Page>
    </Document>
  )
}

export async function renderPersonalWeeklyPdf(
  data: GameweekReportData,
  memberId: string,
): Promise<Buffer> {
  return renderToBuffer(<PersonalWeeklyReport data={data} memberId={memberId} />)
}
