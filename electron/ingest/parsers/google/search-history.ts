import { registerParser } from '../../router'
import type { DataRecord } from '../../../../shared/schema'

// Google Takeout wraps activity entries in an array of objects like:
// { "header": "Search", "title": "Searched for electron vite", "time": "2023-09-15T14:22:00.000Z", "titleUrl": "..." }
interface GoogleActivityItem {
  header?: string
  title?: string
  time?: string
  titleUrl?: string
}

export function parseGoogleSearchHistory(buffer: Buffer): DataRecord[] {
  let items: GoogleActivityItem[]
  try {
    items = JSON.parse(buffer.toString('utf8'))
  } catch {
    return []
  }

  if (!Array.isArray(items)) return []

  const records: DataRecord[] = []

  for (const item of items) {
    if (!item.time) continue

    const timestamp = new Date(item.time).getTime()
    if (isNaN(timestamp)) continue

    // Google prepends "Searched for " — strip it for a cleaner title
    const title = (item.title ?? '').replace(/^Searched for /, '').trim()

    records.push({
      platform: 'google',
      category: 'search',
      timestamp,
      title: title || undefined,
      url: item.titleUrl || undefined,
      metadata: JSON.stringify({ source: 'Search' }),
    })
  }

  return records
}

// Register with the router — matches both with and without "Takeout/" prefix
registerParser('**/My Activity/Search/MyActivity.json', parseGoogleSearchHistory)
