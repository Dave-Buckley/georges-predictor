/**
 * Group weekly PDF renderer.
 *
 * Pure: consumes GameweekReportData, returns Buffer. No DB, no side effects.
 * Uses @react-pdf/renderer primitives exclusively — server-only module.
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
  subtitle: { fontSize: 10, color: '#555', marginBottom: 12 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: 'row', paddingVertical: 2 },
  cellRank: { width: 32 },
  cellName: { flex: 2 },
  cellTotal: { width: 60, textAlign: 'right' },
  cellWeek: { width: 60, textAlign: 'right' },
  banner: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  fixtureRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    borderBottom: '1px solid #eee',
  },
  fixtureTeam: { flex: 1 },
  fixtureScore: { width: 60, textAlign: 'center' },
  h2hCallout: {
    backgroundColor: '#dbeafe',
    padding: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  footer: { marginTop: 20, fontSize: 9, color: '#666' },
  link: { color: '#2563eb', textDecoration: 'underline' },
})

interface Props {
  data: GameweekReportData
}

export function GroupWeeklyReport({ data }: Props) {
  const bonusConfirmed = Object.values(data.bonus.pickByMember).filter(
    (p) => p.awarded === true,
  ).length
  const losRemaining = data.losStatus.filter(
    (l) => !l.eliminated,
  ).length
  const losEliminated = data.losStatus.filter((l) => l.eliminated).length

  const standingsLink = `${APP_URL}/standings`
  const gameweekLink = `${APP_URL}/gameweeks/${data.gwNumber}`

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.h1}>GW {data.gwNumber} — Group Weekly Report</Text>
        <Text style={styles.subtitle}>
          Season {data.seasonLabel}
          {data.closedAtIso ? ` • Closed ${data.closedAtIso.slice(0, 10)}` : ''}
        </Text>

        {data.doubleBubbleActive ? (
          <View style={styles.banner}>
            <Text>Double Bubble active — weekly totals doubled.</Text>
          </View>
        ) : null}

        {/* Standings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Standings</Text>
          <View style={styles.row}>
            <Text style={styles.cellRank}>#</Text>
            <Text style={styles.cellName}>Name</Text>
            <Text style={styles.cellTotal}>Total</Text>
            <Text style={styles.cellWeek}>This GW</Text>
          </View>
          {data.standings.map((s) => (
            <View key={s.memberId} style={styles.row}>
              <Text style={styles.cellRank}>{s.rank}</Text>
              <Text style={styles.cellName}>{s.displayName}</Text>
              <Text style={styles.cellTotal}>{s.totalPoints}</Text>
              <Text style={styles.cellWeek}>{s.weeklyPoints}</Text>
            </View>
          ))}
        </View>

        {/* Top 3 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top 3 weekly</Text>
          {data.topWeekly.map((t, i) => (
            <View key={t.memberId} style={styles.row}>
              <Text style={styles.cellRank}>{['🏆', '🥈', '🥉'][i] ?? ''}</Text>
              <Text style={styles.cellName}>{t.displayName}</Text>
              <Text style={styles.cellWeek}>{t.weeklyPoints} pts</Text>
            </View>
          ))}
        </View>

        {/* Fixtures */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fixture results</Text>
          {data.fixtures.map((f) => (
            <View key={f.id} style={styles.fixtureRow}>
              <Text style={styles.fixtureTeam}>{f.home}</Text>
              <Text style={styles.fixtureScore}>
                {f.homeScore ?? '—'} - {f.awayScore ?? '—'}
              </Text>
              <Text style={styles.fixtureTeam}>{f.away}</Text>
            </View>
          ))}
        </View>

        {/* H2H callouts (only when present — no "None" placeholder) */}
        {data.h2hSteals.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>H2H Steals</Text>
            {data.h2hSteals.map((s, i) => {
              const tiedNames = s.memberIds
                .map(
                  (id) =>
                    data.standings.find((m) => m.memberId === id)
                      ?.displayName ?? id,
                )
                .join(' vs ')
              const status = s.resolvedAt
                ? 'resolved'
                : s.resolvesInGwId
                  ? 'resolving'
                  : 'detected'
              return (
                <View key={i} style={styles.h2hCallout}>
                  <Text>
                    Position {s.position}: {tiedNames} ({status})
                  </Text>
                </View>
              )
            })}
          </View>
        ) : null}

        {/* Bonus summary */}
        <View style={styles.section}>
          <Text>{bonusConfirmed} bonus awards confirmed</Text>
        </View>

        {/* LOS status */}
        <View style={styles.section}>
          <Text>
            LOS: {losRemaining} remaining / {losEliminated} eliminated
          </Text>
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          <Text>
            Full standings:{' '}
            <Link src={standingsLink} style={styles.link}>
              {standingsLink}
            </Link>
          </Text>
          <Text>
            Gameweek details:{' '}
            <Link src={gameweekLink} style={styles.link}>
              {gameweekLink}
            </Link>
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderGroupWeeklyPdf(
  data: GameweekReportData,
): Promise<Buffer> {
  return renderToBuffer(<GroupWeeklyReport data={data} />)
}
