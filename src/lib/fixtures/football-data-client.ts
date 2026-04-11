// ─── football-data.org API Client ────────────────────────────────────────────
// Wraps the v4 API for fetching all PL fixtures in a single call.
// Free tier: 10 requests/min. We use a single endpoint for all 380 fixtures.

export interface FootballDataTeam {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
}

export interface FootballDataScore {
  winner: string | null
  duration: string
  fullTime: {
    home: number | null
    away: number | null
  }
  halfTime: {
    home: number | null
    away: number | null
  }
}

export interface FootballDataSeason {
  id: number
  startDate: string
  endDate: string
  currentMatchday: number | null
}

export interface FootballDataMatch {
  id: number
  utcDate: string
  status: string
  matchday: number
  homeTeam: FootballDataTeam
  awayTeam: FootballDataTeam
  score: FootballDataScore
  season: FootballDataSeason
}

export interface FootballDataResponse {
  filters: Record<string, unknown>
  resultSet: {
    count: number
    first: string
    last: string
    played: number
  }
  matches: FootballDataMatch[]
}

const BASE_URL = 'https://api.football-data.org'

/**
 * Fetches all Premier League matches for the current season.
 * Returns all 380 fixtures in a single API call.
 *
 * @param apiKey - football-data.org API key (X-Auth-Token header)
 * @throws Error if the API responds with a non-OK status
 */
export async function fetchAllMatches(apiKey: string): Promise<FootballDataMatch[]> {
  const response = await fetch(`${BASE_URL}/v4/competitions/PL/matches`, {
    headers: {
      'X-Auth-Token': apiKey,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `football-data.org API error: ${response.status} ${response.statusText}`
    )
  }

  const data: FootballDataResponse = await response.json()
  return data.matches
}
