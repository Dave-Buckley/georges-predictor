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
import { detectNewlyFinished, detectScoreChanged } from '@/lib/fixtures/sync'
import type { FixtureStatusSnapshot, FixtureRow } from '@/lib/fixtures/sync'

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
