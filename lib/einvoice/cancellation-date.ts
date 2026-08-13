/**
 * EIMS reports cancellation dates as Java-style strings carrying an African
 * timezone abbreviation, e.g. "Sun Dec 22 21:55:03 EAT 2024". Node's
 * `new Date()` cannot parse those timezone tokens, so we map the known
 * abbreviations to fixed UTC offsets and build a Date manually.
 */

const TIMEZONE_OFFSETS: Record<string, number> = {
  GMT: 0,
  UTC: 0,
  UT: 0,
  WAT: 1,
  WAST: 1,
  CAT: 2,
  CAST: 2,
  SAST: 2,
  EAT: 3,
  EEST: 3,
  EAST: 3,
}

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

function nativeParse(input: string): Date | null {
  const date = new Date(input)
  return isNaN(date.getTime()) ? null : date
}

/**
 * Parses an EIMS cancellation date string into a Date, or returns null when
 * the value is missing or unrecognised. Callers fall back to `new Date()`.
 */
export function parseCancellationDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "number") {
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date
  }
  if (typeof value !== "string" || !value.trim()) return null

  const input = value.trim()
  const match = input.match(
    /^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+([A-Za-z]{2,4})\s+(\d{4})$/
  )
  if (!match) return nativeParse(input)

  const month = MONTHS[match[1]]
  const offset = TIMEZONE_OFFSETS[match[6].toUpperCase()]
  if (month === undefined || offset === undefined) return nativeParse(input)

  const day = Number(match[2])
  const hour = Number(match[3])
  const minute = Number(match[4])
  const second = Number(match[5])
  const year = Number(match[7])

  // Positive-east offsets are subtracted to reach UTC, e.g. EAT (+3) means
  // the wall-clock time is 3 hours ahead of UTC.
  const date = new Date(
    Date.UTC(year, month, day, hour, minute, second) - offset * 3600 * 1000
  )
  return isNaN(date.getTime()) ? nativeParse(input) : date
}
