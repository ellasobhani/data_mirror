import { registerParser } from '../../router'
import type { DataRecord } from '../../../../shared/schema'

interface GoogleActivityItem {
  header?: string
  title?: string
  time?: string
  titleUrl?: string
}

export function parseGoogleChromeHistory(buffer: Buffer): DataRecord[] {
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

    // Google prepends "Visited " — strip for a cleaner title
    const title = (item.title ?? '').replace(/^Visited /, '').trim()

    records.push({
      platform: 'google',
      category: 'browse',
      timestamp,
      title: title || undefined,
      url: item.titleUrl || undefined,
      metadata: JSON.stringify({ source: 'Chrome' }),
    })
  }
  return records
}

registerParser('**/My Activity/Chrome/MyActivity.json', parseGoogleChromeHistory)
