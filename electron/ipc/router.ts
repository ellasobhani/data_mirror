import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { dialog } from 'electron'
import { getRecords, getAllPlatformStatuses, getDb } from '../db/index'
import { saveLensResult } from '../db/queries'
import { streamIngestFile } from '../ingest/stream-download'
import { saveApiKey, loadApiKey } from '../ai/gemini'
import { runLens, LensId } from '../ai/lenses'
import { rateLens } from '../db/queries'

// Import parsers so their registerParser() calls execute at startup
import '../ingest/parsers/google/search-history'
import '../ingest/parsers/google/youtube'
import '../ingest/parsers/google/chrome'
import '../ingest/parsers/google/location'
import '../ingest/parsers/linkedin/index'

const t = initTRPC.create({ isServer: true })

const lensIdSchema = z.enum(['marketer', 'network', 'relationships'])

export const router = t.router({
  ping: t.procedure.query(() => ({
    message: 'pong',
    timestamp: Date.now(),
  })),

  getRecords: t.procedure
    .input(
      z.object({
        limit:    z.number().int().min(1).max(200).optional().default(50),
        offset:   z.number().int().min(0).optional().default(0),
        platform: z.string().optional(),
        category: z.string().optional(),
      })
    )
    .query(({ input }) => getRecords(input)),

  getPlatformStatuses: t.procedure.query(() => getAllPlatformStatuses()),

  showOpenDialog: t.procedure.query(async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      properties: ['openFile'],
    })
    return result.canceled ? null : result.filePaths[0]
  }),

  showMultiOpenDialog: t.procedure.query(async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      properties: ['openFile', 'multiSelections'],
      message: 'Select one or more Google Takeout ZIPs',
    })
    return result.canceled ? [] : result.filePaths
  }),

  ingestGoogle: t.procedure
    .input(z.object({ paths: z.array(z.string()).min(1) }))
    .mutation(async ({ input }) => {
      let totalFiles = 0
      let totalRecords = 0
      const allUnmatched: string[] = []
      for (const path of input.paths) {
        const { filesProcessed, recordsWritten, sampleUnmatched } = await streamIngestFile(path)
        totalFiles += filesProcessed
        totalRecords += recordsWritten
        for (const f of sampleUnmatched) {
          if (allUnmatched.length < 20) allUnmatched.push(f)
        }
      }
      return { filesProcessed: totalFiles, recordsWritten: totalRecords, sampleUnmatched: allUnmatched }
    }),

  ingestLinkedin: t.procedure
    .input(z.object({ path: z.string() }))
    .mutation(async ({ input }) => {
      // Wipe existing LinkedIn records before re-import
      getDb().prepare('DELETE FROM records WHERE platform = ?').run('linkedin')
      const { recordsWritten } = await streamIngestFile(input.path)
      return { count: recordsWritten }
    }),

  // ── AI / Gemini ───────────────────────────────────────────────
  getGeminiKey: t.procedure.query(() => {
    const key = loadApiKey()
    return { hasKey: !!key, keyPreview: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null }
  }),

  setGeminiKey: t.procedure
    .input(z.object({ key: z.string().min(10) }))
    .mutation(({ input }) => {
      saveApiKey(input.key)
      return { ok: true }
    }),

  getCachedLens: t.procedure
    .input(z.object({ lensId: lensIdSchema }))
    .query(({ input }) => {
      const db = getDb()
      const row = db.prepare(
        'SELECT result, created_at FROM lens_results WHERE lens_id = ?'
      ).get(input.lensId) as { result: string; created_at: number } | undefined
      return row ? { result: row.result, createdAt: row.created_at } : null
    }),

  generateLens: t.procedure
    .input(z.object({ lensId: lensIdSchema }))
    .mutation(async ({ input }) => {
      const result = await runLens(input.lensId as LensId)
      saveLensResult(input.lensId, result)
      return { result }
    }),

  rateLens: t.procedure
    .input(z.object({ lensId: lensIdSchema, quality: z.number().int().min(1).max(5) }))
    .mutation(({ input }) => {
      rateLens(input.lensId, input.quality)
      return { ok: true }
    }),
})

export type AppRouter = typeof router
