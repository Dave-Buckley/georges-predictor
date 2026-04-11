import { formatInTimeZone, getTimezoneOffset } from 'date-fns-tz'

const LONDON_TZ = 'Europe/London'

/**
 * Returns the London timezone abbreviation for a given UTC date.
 * Returns "BST" during British Summer Time (UTC+1) and "GMT" in winter (UTC+0).
 *
 * Note: The 'zzz' token in date-fns-tz returns "GMT+1" in Node.js environments
 * due to ICU data limitations, so we derive the label from the UTC offset instead.
 */
function getLondonTzAbbr(date: Date): string {
  const offsetMs = getTimezoneOffset(LONDON_TZ, date)
  return offsetMs === 0 ? 'GMT' : 'BST'
}

/**
 * Formats a UTC ISO string to a display time in London timezone.
 * Returns "HH:mm zzz" (e.g., "15:00 BST" in summer or "14:00 GMT" in winter).
 */
export function formatKickoffTime(utcString: string): string {
  const date = new Date(utcString)
  const timeStr = formatInTimeZone(date, LONDON_TZ, 'HH:mm')
  const abbr = getLondonTzAbbr(date)
  return `${timeStr} ${abbr}`
}

/**
 * Formats a UTC ISO string to a full display string in London timezone.
 * Returns "EEE d MMM, HH:mm zzz" (e.g., "Sat 16 Aug, 15:00 BST").
 */
export function formatKickoffFull(utcString: string): string {
  const date = new Date(utcString)
  const dateTimeStr = formatInTimeZone(date, LONDON_TZ, 'EEE d MMM, HH:mm')
  const abbr = getLondonTzAbbr(date)
  return `${dateTimeStr} ${abbr}`
}

/**
 * Formats a UTC ISO string to a date-only string in London timezone.
 * Returns "EEE d MMM" (e.g., "Sat 16 Aug").
 */
export function formatKickoffDate(utcString: string): string {
  return formatInTimeZone(new Date(utcString), LONDON_TZ, 'EEE d MMM')
}

/**
 * Returns the day of week (1=Mon, 2=Tue, ..., 7=Sun) in London timezone.
 * Uses ISO weekday convention ('i' token from date-fns).
 */
export function getLondonDayOfWeek(utcString: string): number {
  return parseInt(formatInTimeZone(new Date(utcString), LONDON_TZ, 'i'), 10)
}

/**
 * Returns true if the fixture falls on a midweek day (Mon-Thu) in London time.
 * Midweek = days 1-4 in ISO weekday convention (Mon=1, Tue=2, Wed=3, Thu=4).
 * Weekend = Fri=5, Sat=6, Sun=7.
 */
export function isMidweekFixture(utcString: string): boolean {
  const day = getLondonDayOfWeek(utcString)
  return day >= 1 && day <= 4
}

/**
 * Returns true if the fixture's London date matches today's London date.
 */
export function isToday(utcString: string): boolean {
  const todayStr = formatInTimeZone(new Date(), LONDON_TZ, 'yyyy-MM-dd')
  const fixtureStr = formatInTimeZone(new Date(utcString), LONDON_TZ, 'yyyy-MM-dd')
  return todayStr === fixtureStr
}
