import { describe, it } from 'vitest'

// ─── Sync Engine Tests ────────────────────────────────────────────────────────

describe('syncFixtures()', () => {
  it.todo('upserts teams from API response')
  it.todo('upserts gameweeks from matchdays')
  it.todo('upserts fixtures with correct team/gameweek UUIDs')
  it.todo('detects rescheduled fixture and sets is_rescheduled to true')
  it.todo('creates admin notification on reschedule')
  it.todo('creates admin notification on gameweek move')
  it.todo('writes sync_log on success')
  it.todo('writes sync_log on failure with error message')
  it.todo('returns early with error if FOOTBALL_DATA_API_KEY is not set')
})

// ─── API Route Tests ──────────────────────────────────────────────────────────

describe('GET /api/sync-fixtures', () => {
  it.todo('returns 401 without CRON_SECRET')
  it.todo('calls syncFixtures with valid CRON_SECRET')
  it.todo('triggers first sync when sync_log is empty (first-sync-on-deploy)')
  it.todo('returns 401 for manual request from non-admin session')
  it.todo('accepts manual=true for admin session')
})

// ─── Lockout Utility Tests ────────────────────────────────────────────────────

describe('canSubmitPrediction()', () => {
  it.todo('returns { canSubmit: true } for a future fixture')
  it.todo('returns { canSubmit: false } for a fixture whose kickoff_time has passed')
  it.todo('returns { canSubmit: false } for an IN_PLAY fixture')
  it.todo('returns { canSubmit: false } for a FINISHED fixture')
  it.todo('returns { canSubmit: false } for a POSTPONED fixture')
  it.todo('returns { canSubmit: false, reason: "Fixture not found" } when fixture does not exist')
})

// ─── Admin Actions — Stubs for Plan 02-02 ────────────────────────────────────

describe('addFixture admin action', () => {
  it.todo('validates input with addFixtureSchema')
  it.todo('rejects when home_team_id equals away_team_id')
  it.todo('inserts fixture and returns the new fixture row')
})

describe('editFixture admin action', () => {
  it.todo('updates correct fields from editFixtureSchema')
  it.todo('rejects edits to kicked-off fixtures (kickoff_time in the past) without admin override')
  it.todo('allows admin to force-edit after kickoff with explicit override flag')
})

describe('moveFixture admin action', () => {
  it.todo('changes gameweek_id to the target gameweek')
  it.todo('rejects if target gameweek does not exist')
})
