import { Unzip, UnzipInflate, UnzipPassThrough, type UnzipFile } from 'fflate'
import fs from 'fs'
import { getDb } from '../db/index'
import { routeEntry, type ProgressCallback } from './router'
import type { DataRecord } from '../../shared/schema'

/**
 * Stream-ingest a local ZIP file without writing raw bytes to disk.
 *
 * Design: the ZIP is a transport, not a file you store.
 * - Each entry is decompressed in flight and passed to the router.
 * - The router dispatches to the correct per-platform parser.
 * - Parsed DataRecords are written to SQLite in a per-entry transaction.
 * - Peak memory usage is ~10 MB (one decompressed entry at a time).
 */
export async function streamIngestFile(
  filePath: string,
  onProgress?: ProgressCallback
): Promise<{ filesProcessed: number; recordsWritten: number; sampleUnmatched: string[] }> {
  return new Promise((resolve, reject) => {
    let filesProcessed = 0
    let recordsWritten = 0
    const sampleUnmatched: string[] = []

    const db = getDb()
    const insert = db.prepare(`
      INSERT INTO records (platform, category, timestamp, title, body, url, metadata)
      VALUES (@platform, @category, @timestamp, @title, @body, @url, @metadata)
    `)
    const insertBatch = db.transaction((rows: DataRecord[]) => {
      for (const row of rows) {
        insert.run({
          platform: row.platform,
          category: row.category,
          timestamp: row.timestamp,
          title: row.title ?? null,
          body: row.body ?? null,
          url: row.url ?? null,
          metadata: row.metadata,
        })
      }
    })

    const unzipper = new Unzip()
    unzipper.register(UnzipInflate)      // deflate-compressed entries
    unzipper.register(UnzipPassThrough)  // stored (uncompressed) entries

    unzipper.onfile = (file: UnzipFile) => {
      const chunks: Uint8Array[] = []

      file.ondata = (err: Error | null, chunk: Uint8Array, isFinal: boolean) => {
        if (err) {
          console.error(`[ingest] error reading ${file.name}:`, err)
          filesProcessed++
          return
        }

        chunks.push(chunk)

        if (isFinal) {
          // Reassemble chunks into a single Buffer
          const totalLen = chunks.reduce((n, c) => n + c.length, 0)
          const buf = Buffer.allocUnsafe(totalLen)
          let offset = 0
          for (const c of chunks) {
            buf.set(c, offset)
            offset += c.length
          }

          try {
            const records = routeEntry(file.name, buf)
            if (records && records.length > 0) {
              insertBatch(records)
              recordsWritten += records.length
            } else if (records === null && sampleUnmatched.length < 20) {
              // No parser matched this path — collect for diagnostics
              sampleUnmatched.push(file.name)
            }
          } catch (e) {
            console.error(`[ingest] parser error for ${file.name}:`, e)
          }

          filesProcessed++
          onProgress?.({ filesProcessed, recordsWritten, currentFile: file.name })
        }
      }

      file.start()
    }

    const fileStream = fs.createReadStream(filePath)

    fileStream.on('data', (chunk: Buffer) => {
      unzipper.push(chunk)
    })

    fileStream.on('end', () => {
      // Signal EOF to fflate
      unzipper.push(new Uint8Array(0), true)
      resolve({ filesProcessed, recordsWritten, sampleUnmatched })
    })

    fileStream.on('error', reject)
  })
}
