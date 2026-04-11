// ─── Import Text Parser ───────────────────────────────────────────────────────
// Pure functions for parsing pasted text into structured import rows.
// No DB calls, no side effects — ideal for client-side preview and unit testing.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportRow {
  display_name: string
  starting_points: number
}

export interface ImportError {
  line: number
  message: string
}

export interface ImportResult {
  rows: ImportRow[]
  errors: ImportError[]
}

export interface PreSeasonPickRow {
  member_name: string
  top4: string[]
  tenth_place: string
  relegated: string[]
  promoted: string[]
  promoted_playoff_winner: string
}

export interface PreSeasonPicksResult {
  rows: PreSeasonPickRow[]
  errors: ImportError[]
}

// ─── parseImportText ──────────────────────────────────────────────────────────
// Parses comma-separated or tab-separated "Name, Points" rows.
// Returns accumulated rows and errors — partial success is supported.

export function parseImportText(text: string): ImportResult {
  const lines = text.split('\n').filter((l) => l.trim() !== '')

  if (lines.length === 0) {
    return { rows: [], errors: [{ line: -1, message: 'No data to import' }] }
  }

  const rows: ImportRow[] = []
  const errors: ImportError[] = []

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const parts = lines[i].split(/[,\t]/).map((p) => p.trim())

    if (parts.length < 2) {
      errors.push({
        line: lineNum,
        message: `Expected "Name, Points" — got: ${lines[i].trim()}`,
      })
      continue
    }

    const display_name = parts[0]
    const pointsStr = parts[1]

    // Validate name
    if (!display_name) {
      errors.push({ line: lineNum, message: 'Name cannot be empty' })
      continue
    }

    // Validate points — must be a non-negative integer (no decimals)
    if (pointsStr.includes('.')) {
      errors.push({
        line: lineNum,
        message: `Invalid points value: ${pointsStr} (must be a whole number)`,
      })
      continue
    }

    const starting_points = parseInt(pointsStr, 10)

    if (isNaN(starting_points)) {
      errors.push({
        line: lineNum,
        message: `Invalid points value: ${pointsStr} (must be a number)`,
      })
      continue
    }

    if (starting_points < 0) {
      errors.push({
        line: lineNum,
        message: `Invalid points value: ${pointsStr} (cannot be negative)`,
      })
      continue
    }

    rows.push({ display_name, starting_points })
  }

  // Check for duplicate names (case-insensitive)
  const names = rows.map((r) => r.display_name.toLowerCase())
  const seen = new Set<string>()
  const dupes = new Set<string>()

  for (const name of names) {
    if (seen.has(name)) {
      dupes.add(name)
    }
    seen.add(name)
  }

  if (dupes.size > 0) {
    const dupeList = [...dupes].join(', ')
    errors.push({
      line: -1,
      message: `Duplicate names found: ${dupeList}`,
    })
  }

  return { rows, errors }
}

// ─── parsePreSeasonPicksText ──────────────────────────────────────────────────
// Parses 13-column rows: Name, Top4x4, 10th, Relegated x3, Promoted x3, PlayoffWinner
// Column order: member_name, top4_1, top4_2, top4_3, top4_4, tenth_place,
//               relegated_1, relegated_2, relegated_3,
//               promoted_1, promoted_2, promoted_3, promoted_playoff_winner

const PRE_SEASON_COLUMN_COUNT = 13

export function parsePreSeasonPicksText(text: string): PreSeasonPicksResult {
  const lines = text.split('\n').filter((l) => l.trim() !== '')

  if (lines.length === 0) {
    return { rows: [], errors: [{ line: -1, message: 'No data to import' }] }
  }

  const rows: PreSeasonPickRow[] = []
  const errors: ImportError[] = []

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const parts = lines[i].split(/[,\t]/).map((p) => p.trim())

    if (parts.length < PRE_SEASON_COLUMN_COUNT) {
      errors.push({
        line: lineNum,
        message: `Expected 13 columns — got ${parts.length}. Format: Name, Top4x4, 10th, Relegated x3, Promoted x3, PlayoffWinner`,
      })
      continue
    }

    // Check for any empty fields
    const emptyIndex = parts.slice(0, PRE_SEASON_COLUMN_COUNT).findIndex((p) => p === '')
    if (emptyIndex !== -1) {
      errors.push({
        line: lineNum,
        message: `Column ${emptyIndex + 1} is empty — all fields are required`,
      })
      continue
    }

    const [
      member_name,
      top4_1,
      top4_2,
      top4_3,
      top4_4,
      tenth_place,
      relegated_1,
      relegated_2,
      relegated_3,
      promoted_1,
      promoted_2,
      promoted_3,
      promoted_playoff_winner,
    ] = parts

    rows.push({
      member_name,
      top4: [top4_1, top4_2, top4_3, top4_4],
      tenth_place,
      relegated: [relegated_1, relegated_2, relegated_3],
      promoted: [promoted_1, promoted_2, promoted_3],
      promoted_playoff_winner,
    })
  }

  // Check for duplicate member names (case-insensitive)
  const names = rows.map((r) => r.member_name.toLowerCase())
  const seen = new Set<string>()
  const dupes = new Set<string>()

  for (const name of names) {
    if (seen.has(name)) {
      dupes.add(name)
    }
    seen.add(name)
  }

  if (dupes.size > 0) {
    const dupeList = [...dupes].join(', ')
    errors.push({
      line: -1,
      message: `Duplicate member names found: ${dupeList}`,
    })
  }

  return { rows, errors }
}
