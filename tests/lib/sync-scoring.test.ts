/**
 * Tests for FINISHED-transition detection logic in sync.ts
 *
 * Covers the detectNewlyFinished helper which guards against double-scoring:
 * - Only transitions TO FINISHED from a non-FINISHED state trigger scoring
 * - Already-FINISHED fixtures are NOT re-scored
 * - Fixtures with null scores are NOT scored even if status is FINISHED
 * - Non-FINISHED status transitions (e.g. IN_PLAY) do NOT trigger scoring
 */
import { describe, it, expect } from 'vitest'
import { detectNewlyFinished, detectScoreChanged, findMirrorCandidates } from '@/lib/fixtures/sync'
import type {
  FixtureStatusSnapshot,
  FixtureRow,
  ManualFixtureNeedingResult,
  MirrorDonor,
} from '@/lib/fixtures/sync'

const EXTERNAL_ID_1 = 1001
const EXTERNAL_ID_2 = 1002
const EXTERNAL_ID_3 = 1003
const EXTERNAL_ID_4 = 1004

// Helper to build a prevStatusMap from an array of snapshots
function buildPrevMap(snapshots: FixtureStatusSnapshot[]): Map<number, FixtureStatusSnapshot> {
  const map = new Map<number, FixtureStatusSnapshot>()
  for (const s of snapshots) {
    map.set(s.external_id, s)
  }
  return map
}

describe('detectNewlyFinished', () => {
  it('includes fixture transitioning from SCHEDULED to FINISHED with scores', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'SCHEDULED', home_score: null, away_score: null },
    ])

    const result = detectNewlyFinished(fixtureRows, prevMap)
    expect(result).toHaveLength(1)
    expect(result[0].external_id).toBe(EXTERNAL_ID_1)
  })

  it('includes fixture transitioning from IN_PLAY to FINISHED with scores', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 3, away_score: 0 },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'IN_PLAY', home_score: null, away_score: null },
    ])

    const result = detectNewlyFinished(fixtureRows, prevMap)
    expect(result).toHaveLength(1)
    expect(result[0].external_id).toBe(EXTERNAL_ID_1)
  })

  it('excludes fixture that was already FINISHED before this sync (no double-scoring)', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
    ])

    const result = detectNewlyFinished(fixtureRows, prevMap)
    expect(result).toHaveLength(0)
  })

  it('excludes fixture transitioning to FINISHED but with null home_score', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: null, away_score: 1 },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'SCHEDULED', home_score: null, away_score: null },
    ])

    const result = detectNewlyFinished(fixtureRows, prevMap)
    expect(result).toHaveLength(0)
  })

  it('excludes fixture transitioning to FINISHED but with null away_score', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: null },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'SCHEDULED', home_score: null, away_score: null },
    ])

    const result = detectNewlyFinished(fixtureRows, prevMap)
    expect(result).toHaveLength(0)
  })

  it('excludes fixture transitioning to IN_PLAY (not FINISHED)', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'IN_PLAY', home_score: null, away_score: null },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'SCHEDULED', home_score: null, away_score: null },
    ])

    const result = detectNewlyFinished(fixtureRows, prevMap)
    expect(result).toHaveLength(0)
  })

  it('handles a mix: only newly-FINISHED fixtures with scores are included', () => {
    const fixtureRows: FixtureRow[] = [
      // Should score: SCHEDULED -> FINISHED with scores
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
      // Should NOT score: already FINISHED
      { external_id: EXTERNAL_ID_2, status: 'FINISHED', home_score: 3, away_score: 0 },
      // Should NOT score: FINISHED but null scores
      { external_id: EXTERNAL_ID_3, status: 'FINISHED', home_score: null, away_score: null },
      // Should NOT score: IN_PLAY transition
      { external_id: EXTERNAL_ID_4, status: 'IN_PLAY', home_score: null, away_score: null },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'IN_PLAY', home_score: null, away_score: null },
      { external_id: EXTERNAL_ID_2, status: 'FINISHED', home_score: 3, away_score: 0 },
      { external_id: EXTERNAL_ID_3, status: 'SCHEDULED', home_score: null, away_score: null },
      { external_id: EXTERNAL_ID_4, status: 'SCHEDULED', home_score: null, away_score: null },
    ])

    const result = detectNewlyFinished(fixtureRows, prevMap)
    expect(result).toHaveLength(1)
    expect(result[0].external_id).toBe(EXTERNAL_ID_1)
  })

  it('includes fixture that has no prior snapshot (brand new fixture arriving as FINISHED)', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 1, away_score: 1 },
    ]
    // No previous snapshot — the fixture didn't exist in DB before
    const prevMap = new Map<number, FixtureStatusSnapshot>()

    const result = detectNewlyFinished(fixtureRows, prevMap)
    // prev is undefined, so prev?.status !== 'FINISHED' is true (undefined !== 'FINISHED')
    expect(result).toHaveLength(1)
    expect(result[0].external_id).toBe(EXTERNAL_ID_1)
  })
})

describe('detectScoreChanged', () => {
  it('detects a score change on a fixture that was already FINISHED (VAR correction)', () => {
    // The exact case that bit George: API said 1-1, then corrected to 0-1.
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 0, away_score: 1 },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 1, away_score: 1 },
    ])

    const result = detectScoreChanged(fixtureRows, prevMap)
    expect(result).toHaveLength(1)
    expect(result[0].external_id).toBe(EXTERNAL_ID_1)
    expect(result[0].prev_home).toBe(1)
    expect(result[0].prev_away).toBe(1)
    expect(result[0].home_score).toBe(0)
    expect(result[0].away_score).toBe(1)
  })

  it('excludes a fixture whose score is unchanged', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
    ])

    expect(detectScoreChanged(fixtureRows, prevMap)).toHaveLength(0)
  })

  it('excludes a fixture transitioning into FINISHED for the first time (handled by detectNewlyFinished instead)', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'IN_PLAY', home_score: null, away_score: null },
    ])

    expect(detectScoreChanged(fixtureRows, prevMap)).toHaveLength(0)
  })

  it('excludes a fixture with no prior snapshot — there is no "previous score" to compare to', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
    ]
    expect(detectScoreChanged(fixtureRows, new Map())).toHaveLength(0)
  })

  it('excludes a fixture whose new score is null (data feed glitch — never replace a real score with null)', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: null, away_score: null },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
    ])

    expect(detectScoreChanged(fixtureRows, prevMap)).toHaveLength(0)
  })

  it('separates only-home-changed and only-away-changed fixtures', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 1, away_score: 1 },
      { external_id: EXTERNAL_ID_2, status: 'FINISHED', home_score: 2, away_score: 0 },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 0, away_score: 1 },
      { external_id: EXTERNAL_ID_2, status: 'FINISHED', home_score: 2, away_score: 1 },
    ])

    const result = detectScoreChanged(fixtureRows, prevMap)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.external_id).sort()).toEqual([EXTERNAL_ID_1, EXTERNAL_ID_2])
  })

  it('excludes a fixture that left FINISHED status (e.g. moved to POSTPONED) — score-change semantics only apply between two FINISHED states', () => {
    const fixtureRows: FixtureRow[] = [
      { external_id: EXTERNAL_ID_1, status: 'POSTPONED', home_score: null, away_score: null },
    ]
    const prevMap = buildPrevMap([
      { external_id: EXTERNAL_ID_1, status: 'FINISHED', home_score: 2, away_score: 1 },
    ])
    expect(detectScoreChanged(fixtureRows, prevMap)).toHaveLength(0)
  })
})

// ─── findMirrorCandidates ────────────────────────────────────────────────────
// The placeholder-fixture case: George manually inserts a row with a synthetic
// external_id so the predictor can carry the match before football-data.org has
// published it in the correct matchday. When the API later publishes the real
// fixture (different external_id, different matchday in the DB) we need to
// mirror the score across so predictions get scored.

const MAN_CITY = 'team-mci'
const CRYSTAL_PALACE = 'team-cry'
const ARSENAL = 'team-ars'
const WEST_HAM = 'team-whu'

function manual(overrides: Partial<ManualFixtureNeedingResult> = {}): ManualFixtureNeedingResult {
  return {
    id: 'manual-1',
    external_id: 9000036,
    home_team_id: MAN_CITY,
    away_team_id: CRYSTAL_PALACE,
    kickoff_time: '2026-05-13T19:00:00+00:00',
    status: 'TIMED',
    home_score: null,
    away_score: null,
    ...overrides,
  }
}

function donor(overrides: Partial<MirrorDonor> = {}): MirrorDonor {
  return {
    id: 'donor-1',
    external_id: 538091,
    home_team_id: MAN_CITY,
    away_team_id: CRYSTAL_PALACE,
    kickoff_time: '2026-05-13T19:00:00+00:00',
    status: 'FINISHED',
    home_score: 3,
    away_score: 0,
    ...overrides,
  }
}

describe('findMirrorCandidates', () => {
  it('mirrors when team pair and kickoff match exactly (the MCI vs CRY GW36 case)', () => {
    const pairs = findMirrorCandidates([manual()], [donor()])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].manual.external_id).toBe(9000036)
    expect(pairs[0].donor.external_id).toBe(538091)
  })

  it('mirrors when the API rescheduled the kickoff by a few hours', () => {
    const d = donor({ kickoff_time: '2026-05-13T20:30:00+00:00' }) // 1.5h later
    const pairs = findMirrorCandidates([manual()], [d])
    expect(pairs).toHaveLength(1)
  })

  it('does NOT mirror the OTHER home-leg of the same team pair months away', () => {
    // PL fixture from the reverse half of the season — same team-pair row could
    // exist in the DB. 48h tolerance rules it out.
    const earlierLeg = donor({
      id: 'donor-earlier-leg',
      external_id: 537936,
      kickoff_time: '2025-12-14T14:00:00+00:00',
      home_score: 0,
      away_score: 3,
    })
    const pairs = findMirrorCandidates([manual()], [earlierLeg])
    expect(pairs).toHaveLength(0)
  })

  it('does NOT mirror a donor whose status is not FINISHED', () => {
    const d = donor({ status: 'IN_PLAY', home_score: 1, away_score: 0 })
    expect(findMirrorCandidates([manual()], [d])).toHaveLength(0)
  })

  it('does NOT mirror a donor with null scores even if it is FINISHED', () => {
    const d = donor({ home_score: null, away_score: null })
    expect(findMirrorCandidates([manual()], [d])).toHaveLength(0)
  })

  it('does NOT mirror a row onto itself even if it matches everything', () => {
    // The manual row appearing in BOTH lists must not pair with itself.
    const m = manual({ status: 'FINISHED', home_score: 3, away_score: 0 })
    expect(findMirrorCandidates([m], [m as unknown as MirrorDonor])).toHaveLength(0)
  })

  it('does NOT pair when the team pair differs (different match entirely)', () => {
    const m = manual({ home_team_id: ARSENAL, away_team_id: WEST_HAM })
    const d = donor() // MCI vs CRY
    expect(findMirrorCandidates([m], [d])).toHaveLength(0)
  })

  it('picks the closest-in-time donor when multiple FINISHED rows have the same team pair', () => {
    const closer = donor({
      id: 'donor-closer',
      external_id: 999001,
      kickoff_time: '2026-05-13T19:30:00+00:00', // 30 min later
      home_score: 2,
      away_score: 1,
    })
    const further = donor({
      id: 'donor-further',
      external_id: 999002,
      kickoff_time: '2026-05-12T19:00:00+00:00', // 24h earlier
      home_score: 9,
      away_score: 9,
    })
    const pairs = findMirrorCandidates([manual()], [further, closer])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].donor.id).toBe('donor-closer')
  })
})
