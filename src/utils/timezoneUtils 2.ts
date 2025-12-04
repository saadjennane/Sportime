/**
 * Timezone Utilities
 *
 * Provides timezone-aware date/time formatting and calculations
 * Auto-detects browser timezone when user preference not set
 */

import type { User } from '@supabase/supabase-js'

const DEFAULT_FALLBACK_TZ = 'UTC'

/**
 * Get user's timezone
 * Priority: 1. User DB setting, 2. Browser detection, 3. UTC fallback
 *
 * @param user - Supabase user object (optional, may contain timezone in user_metadata)
 * @returns IANA timezone string (e.g., "Europe/Paris", "America/New_York")
 */
export function getUserTimezone(user?: User | null): string {
  // 1. Check if user has explicit timezone setting in metadata
  if (user?.user_metadata?.timezone) {
    return user.user_metadata.timezone
  }

  // 2. Try to detect from browser
  try {
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (detectedTz) {
      return detectedTz
    }
  } catch (error) {
    console.warn('[timezoneUtils] Failed to detect browser timezone:', error)
  }

  // 3. Fallback to UTC
  return DEFAULT_FALLBACK_TZ
}

/**
 * Format match time according to user's timezone
 *
 * @param isoDate - ISO 8601 date string (e.g., "2025-11-17T20:00:00Z")
 * @param timezone - IANA timezone string
 * @param options - Intl.DateTimeFormatOptions (optional)
 * @returns Formatted time string (default: "HH:mm" format)
 */
export function formatMatchTime(
  isoDate: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const date = new Date(isoDate)

    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
      ...defaultOptions,
      ...options,
    })

    return formatter.format(date)
  } catch (error) {
    console.error('[timezoneUtils] Failed to format match time:', error)
    // Fallback to simple time display
    return new Date(isoDate).toLocaleTimeString().slice(0, 5)
  }
}

/**
 * Format full date and time according to user's timezone
 *
 * @param isoDate - ISO 8601 date string
 * @param timezone - IANA timezone string
 * @returns Formatted date-time string (e.g., "Nov 17, 2025, 20:00")
 */
export function formatDateTime(isoDate: string, timezone: string): string {
  try {
    const date = new Date(isoDate)

    const formatter = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    })

    return formatter.format(date)
  } catch (error) {
    console.error('[timezoneUtils] Failed to format date-time:', error)
    return new Date(isoDate).toLocaleString()
  }
}

/**
 * Get local day boundaries (start and end of day) in a specific timezone
 * Used for filtering "matches of the day"
 *
 * @param timezone - IANA timezone string
 * @param referenceDate - Reference date (default: now)
 * @returns Object with startISO and endISO in UTC format
 */
export function getLocalDayBounds(
  timezone: string,
  referenceDate: Date = new Date()
): { startISO: string; endISO: string } {
  try {
    // Get the local date string in the target timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone,
    })

    const localDateStr = formatter.format(referenceDate) // Format: YYYY-MM-DD

    // Create start of day (00:00:00) in target timezone
    const startStr = `${localDateStr}T00:00:00`
    const endStr = `${localDateStr}T23:59:59.999`

    // Parse these as UTC, then adjust to get the actual UTC timestamp
    // for the local time in the target timezone
    const startDate = parseLocalTimeInTimezone(startStr, timezone)
    const endDate = parseLocalTimeInTimezone(endStr, timezone)

    return {
      startISO: startDate.toISOString(),
      endISO: endDate.toISOString(),
    }
  } catch (error) {
    console.error('[timezoneUtils] Failed to calculate day bounds:', error)

    // Fallback: use browser's local timezone
    const start = new Date(referenceDate)
    start.setHours(0, 0, 0, 0)

    const end = new Date(referenceDate)
    end.setHours(23, 59, 59, 999)

    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    }
  }
}

/**
 * Helper: Parse a local time string as if it were in a specific timezone
 * and return the equivalent UTC Date object
 *
 * @param localTimeStr - Local time string (e.g., "2025-11-17T20:00:00")
 * @param timezone - IANA timezone string
 * @returns Date object in UTC representing that local time
 */
function parseLocalTimeInTimezone(localTimeStr: string, timezone: string): Date {
  // Create a temporary date assuming UTC
  const tempDate = new Date(localTimeStr + 'Z') // Append Z to treat as UTC

  // Get the offset for the target timezone at this time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(tempDate)
  const partMap: Record<string, string> = {}
  parts.forEach(part => {
    if (part.type !== 'literal') {
      partMap[part.type] = part.value
    }
  })

  // Reconstruct the date in the target timezone
  const tzDateStr = `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}:${partMap.second}`
  const tzDate = new Date(tzDateStr)

  // Calculate the offset
  const offset = tempDate.getTime() - tzDate.getTime()

  // Apply inverse offset to get UTC time for the original local time
  return new Date(tempDate.getTime() - offset)
}

/**
 * Check if a date falls within today in a specific timezone
 *
 * @param isoDate - ISO 8601 date string to check
 * @param timezone - IANA timezone string
 * @returns true if date is today in the given timezone
 */
export function isToday(isoDate: string, timezone: string): boolean {
  const { startISO, endISO } = getLocalDayBounds(timezone)
  const checkDate = new Date(isoDate).getTime()
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()

  return checkDate >= start && checkDate <= end
}

/**
 * Get list of common timezones for UI dropdown
 * Organized by region
 */
export const COMMON_TIMEZONES = [
  { region: 'Africa', zones: [
    'Africa/Casablanca',
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Africa/Lagos',
    'Africa/Nairobi',
  ]},
  { region: 'America', zones: [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Mexico_City',
    'America/Sao_Paulo',
  ]},
  { region: 'Asia', zones: [
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Shanghai',
    'Asia/Tokyo',
  ]},
  { region: 'Europe', zones: [
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Moscow',
  ]},
  { region: 'Pacific', zones: [
    'Pacific/Auckland',
    'Pacific/Sydney',
    'Pacific/Honolulu',
  ]},
]

/**
 * Get friendly timezone display name
 *
 * @param timezone - IANA timezone string
 * @returns Friendly name (e.g., "Paris (GMT+1)")
 */
export function getTimezoneFriendlyName(timezone: string): string {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    })

    const parts = formatter.formatToParts(now)
    const tzName = parts.find(part => part.type === 'timeZoneName')?.value || ''

    // Extract city name from IANA string
    const cityName = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone

    return `${cityName} (${tzName})`
  } catch (error) {
    return timezone
  }
}
