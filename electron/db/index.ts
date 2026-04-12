import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { CREATE_TABLES, MIGRATIONS } from './schema'
import type { DataRecord, PlatformStatus } from '../../shared/schema'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = path.join(app.getPath('userData'), 'data-mirror.db')
    _db = new Database(dbPath)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    _db.exec(CREATE_TABLES)
    for (const migration of MIGRATIONS) {
      try { _db.exec(migration) } catch { /* column/table already exists */ }
    }
  }
  return _db
}

export function seedFakeRecords(): void {
  const db = getDb()
  const count = (db.prepare('SELECT COUNT(*) as n FROM records').get() as { n: number }).n
  if (count > 0) return  // already seeded

  const fake: Omit<DataRecord, 'id'>[] = [
    {
      platform: 'google',
      category: 'search',
      timestamp: Date.now() - 1000 * 60 * 60 * 2,
      title: 'how does streaming zip decompression work',
      metadata: JSON.stringify({ source: 'Search' }),
    },
    {
      platform: 'google',
      category: 'search',
      timestamp: Date.now() - 1000 * 60 * 60 * 5,
      title: 'electron ipc best practices',
      metadata: JSON.stringify({ source: 'Search' }),
    },
    {
      platform: 'google',
      category: 'browse',
      timestamp: Date.now() - 1000 * 60 * 60 * 8,
      title: 'better-sqlite3 documentation',
      url: 'https://github.com/WiseLibs/better-sqlite3',
      metadata: JSON.stringify({ source: 'Chrome' }),
    },
    {
      platform: 'meta',
      category: 'social',
      timestamp: Date.now() - 1000 * 60 * 60 * 24,
      title: 'Liked a post',
      metadata: JSON.stringify({ source: 'Facebook' }),
    },
    {
      platform: 'spotify',
      category: 'media',
      timestamp: Date.now() - 1000 * 60 * 30,
      title: 'Daft Punk — Get Lucky',
      metadata: JSON.stringify({ artist: 'Daft Punk', album: 'Random Access Memories' }),
    },
    {
      platform: 'amazon',
      category: 'purchase',
      timestamp: Date.now() - 1000 * 60 * 60 * 48,
      title: 'USB-C Hub 7-in-1',
      metadata: JSON.stringify({ orderId: '112-FAKE-001', price: '$29.99' }),
    },
  ]

  const insert = db.prepare(`
    INSERT INTO records (platform, category, timestamp, title, body, url, metadata)
    VALUES (@platform, @category, @timestamp, @title, @body, @url, @metadata)
  `)

  const insertMany = db.transaction((rows: typeof fake) => {
    for (const row of rows) insert.run({ body: null, url: null, ...row })
  })

  insertMany(fake)
}

export function getRecords(opts: {
  limit?: number
  offset?: number
  platform?: string
  category?: string
}): { records: DataRecord[]; total: number } {
  const db = getDb()
  const { limit = 50, offset = 0, platform, category } = opts

  const conditions: string[] = []
  const params: Record<string, unknown> = { limit, offset }

  if (platform) { conditions.push('platform = @platform'); params.platform = platform }
  if (category) { conditions.push('category = @category'); params.category = category }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const records = db.prepare(`
    SELECT * FROM records ${where}
    ORDER BY timestamp DESC
    LIMIT @limit OFFSET @offset
  `).all(params) as DataRecord[]

  const { total } = db.prepare(`
    SELECT COUNT(*) as total FROM records ${where}
  `).get(params) as { total: number }

  return { records, total }
}

export function getAllPlatformStatuses(): PlatformStatus[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM platform_status').all() as Array<{
    platform: string
    status: string
    requested_at: number | null
    ready_at: number | null
    record_count: number
    error: string | null
  }>
  return rows.map(r => ({
    platform: r.platform as PlatformStatus['platform'],
    status: r.status as PlatformStatus['status'],
    requestedAt: r.requested_at ?? undefined,
    readyAt: r.ready_at ?? undefined,
    recordCount: r.record_count,
    error: r.error ?? undefined,
  }))
}
