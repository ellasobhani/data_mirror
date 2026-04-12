import { getDb } from './index'

// ── Lens results ──────────────────────────────────────────────────────────────

export function getLensResult(lensId: string): {
  result: string
  lens_quality: number | null
  created_at: number
} | null {
  const db = getDb()
  return db.prepare(
    `SELECT result, lens_quality, created_at FROM lens_results WHERE lens_id = ?`
  ).get(lensId) as { result: string; lens_quality: number | null; created_at: number } | null
}

export function saveLensResult(lensId: string, result: string): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO lens_results (lens_id, result, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(lens_id) DO UPDATE SET result = excluded.result, created_at = excluded.created_at`
  ).run(lensId, result, Date.now())
}

export function rateLens(lensId: string, quality: number): void {
  if (quality < 1 || quality > 5) throw new Error('lens_quality must be 1–5')
  const db = getDb()
  db.prepare(
    `UPDATE lens_results SET lens_quality = ? WHERE lens_id = ?`
  ).run(quality, lensId)
}

// ── Reclaim actions ───────────────────────────────────────────────────────────

export type ReclaimStatus = 'pending' | 'submitted' | 'confirmed' | 'failed'

export interface ReclaimAction {
  id?: number
  platform: string
  action_type: string
  status: ReclaimStatus
  submitted_at?: number
  confirmed_at?: number
  notes?: string
}

export function upsertReclaimAction(action: Omit<ReclaimAction, 'id'>): number {
  const db = getDb()
  const result = db.prepare(
    `INSERT INTO reclaim_actions (platform, action_type, status, submitted_at, confirmed_at, notes)
     VALUES (@platform, @action_type, @status, @submitted_at, @confirmed_at, @notes)
     ON CONFLICT DO NOTHING`
  ).run({
    platform: action.platform,
    action_type: action.action_type,
    status: action.status,
    submitted_at: action.submitted_at ?? null,
    confirmed_at: action.confirmed_at ?? null,
    notes: action.notes ?? null,
  })
  if (result.changes > 0) return Number(result.lastInsertRowid)
  // Row already existed — return its id
  const existing = db.prepare(
    `SELECT id FROM reclaim_actions WHERE platform = ? AND action_type = ?`
  ).get(action.platform, action.action_type) as { id: number }
  return existing.id
}

export function updateReclaimStatus(
  id: number,
  status: ReclaimStatus,
  timestamp?: number
): void {
  const db = getDb()
  if (status === 'submitted') {
    db.prepare(
      `UPDATE reclaim_actions SET status = ?, submitted_at = ? WHERE id = ?`
    ).run(status, timestamp ?? Date.now(), id)
  } else if (status === 'confirmed') {
    db.prepare(
      `UPDATE reclaim_actions SET status = ?, confirmed_at = ? WHERE id = ?`
    ).run(status, timestamp ?? Date.now(), id)
  } else {
    db.prepare(`UPDATE reclaim_actions SET status = ? WHERE id = ?`).run(status, id)
  }
}

export function getReclaimActions(platform?: string): ReclaimAction[] {
  const db = getDb()
  if (platform) {
    return db.prepare(
      `SELECT * FROM reclaim_actions WHERE platform = ? ORDER BY id ASC`
    ).all(platform) as ReclaimAction[]
  }
  return db.prepare(
    `SELECT * FROM reclaim_actions ORDER BY platform ASC, id ASC`
  ).all() as ReclaimAction[]
}
