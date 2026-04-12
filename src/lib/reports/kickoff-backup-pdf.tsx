/**
 * Kickoff backup PDF — disaster-recovery snapshot of every member's
 * predictions / LOS / bonus picks as LOCKED at first fixture kickoff.
 *
 * Contains NO actual scores — the match results haven't happened yet.
 */
import 'server-only'
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

import type { GameweekReportData } from './_data/gather-gameweek-data'

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: 'Helvetica' },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#555', marginBottom: 12 },
  memberSection: {
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: '1px solid #ddd',
  },
  memberName: { fontSize: 12, fontWeight: 700, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    paddingVertical: 1,
  },
  fixtureLabel: { flex: 2 },
  predCell: { width: 60, textAlign: 'center' },
  meta: { marginTop: 4, color: '#333' },
})

interface Props {
  data: GameweekReportData
}

export function KickoffBackupReport({ data }: Props) {
  const fixturesById = new Map(data.fixtures.map((f) => [f.id, f]))

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <Text style={styles.h1}>
          Kickoff Backup — GW {data.gwNumber}
        </Text>
        <Text style={styles.subtitle}>
          All predictions as locked at kickoff • Season {data.seasonLabel}
        </Text>

        {data.standings.map((m) => {
          const preds = data.predictionsByMember[m.memberId] ?? []
          const los = data.losStatus.find((l) => l.memberId === m.memberId)
          const bonus = data.bonus.pickByMember[m.memberId]
          return (
            <View key={m.memberId} style={styles.memberSection} wrap={false}>
              <Text style={styles.memberName}>{m.displayName}</Text>
              <View style={styles.row}>
                <Text style={styles.fixtureLabel}>Fixture</Text>
                <Text style={styles.predCell}>Home</Text>
                <Text style={styles.predCell}>Away</Text>
              </View>
              {preds.map((p) => {
                const f = fixturesById.get(p.fixtureId)
                if (!f) return null
                return (
                  <View key={p.fixtureId} style={styles.row}>
                    <Text style={styles.fixtureLabel}>
                      {f.home} vs {f.away}
                    </Text>
                    <Text style={styles.predCell}>{p.homePrediction}</Text>
                    <Text style={styles.predCell}>{p.awayPrediction}</Text>
                  </View>
                )
              })}
              {los?.teamPicked ? (
                <Text style={styles.meta}>
                  LOS pick: {los.teamPicked}
                </Text>
              ) : null}
              {bonus?.fixtureId ? (
                <Text style={styles.meta}>
                  Bonus pick: fixture {bonus.fixtureId}
                </Text>
              ) : null}
            </View>
          )
        })}
      </Page>
    </Document>
  )
}

export async function renderKickoffBackupPdf(
  data: GameweekReportData,
): Promise<Buffer> {
  return renderToBuffer(<KickoffBackupReport data={data} />)
}
