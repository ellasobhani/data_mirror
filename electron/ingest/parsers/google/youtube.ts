import { registerParser } from '../../router'
import type { DataRecord } from '../../../../shared/schema'

interface GoogleActivityItem {
  header?: string
  title?: string
  time?: string
  titleUrl?: string
}

export function parseGoogleYouTubeHistory(buffer: Buffer): DataRecord[] {
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

    // Google prepends "Watched " — strip for a cleaner title
    const title = (item.title ?? '').replace(/^Watched /, '').trim()

    records.push({
      platform: 'google',
      category: 'media',
      timestamp,
      title: title || undefined,
      url: item.titleUrl || undefined,
      metadata: JSON.stringify({ source: 'YouTube' }),
    })
  }
  return records
}

registerParser('**/My Activity/YouTube/MyActivity.json', parseGoogleYouTubeHistory)
