import { registerParser } from '../../router'
import type { DataRecord } from '../../../../shared/schema'

// Google Location History schema (Records.json)
// { "locations": [{ "latitudeE7": 374260000, "longitudeE7": -1221900000, "timestamp": "2023-09-15T14:22:00.000Z", "accuracy": 10 }] }
interface LocationEntry {
  latitudeE7?: number
  longitudeE7?: number
  timestamp?: string
  accuracy?: number
  altitude?: number
  activity?: unknown[]
}

interface LocationHistoryFile {
  locations?: LocationEntry[]
}

export function parseGoogleLocationHistory(buffer: Buffer): DataRecord[] {
  let parsed: LocationHistoryFile
  try {
    parsed = JSON.parse(buffer.toString('utf8'))
  } catch {
    return []
  }

  const locations = parsed.locations
  if (!Array.isArray(locations)) return []

  const records: DataRecord[] = []
  for (const loc of locations) {
    if (!loc.timestamp) continue
    const timestamp = new Date(loc.timestamp).getTime()
    if (isNaN(timestamp)) continue

    // Convert E7 fixed-point integers to decimal degrees
    const lat = loc.latitudeE7 != null ? loc.latitudeE7 / 1e7 : null
    const lng = loc.longitudeE7 != null ? loc.longitudeE7 / 1e7 : null

    records.push({
      platform: 'google',
      category: 'location',
      timestamp,
      title: lat != null && lng != null
        ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        : '(location)',
      metadata: JSON.stringify({
        source: 'Location History',
        lat,
        lng,
        accuracy: loc.accuracy ?? null,
        altitude: loc.altitude ?? null,
      }),
    })
  }
  return records
}

registerParser('**/Location History/Records.json', parseGoogleLocationHistory)
// Older Takeout layout
registerParser('**/Location History/Location History.json', parseGoogleLocationHistory)
