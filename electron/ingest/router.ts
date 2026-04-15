import type { DataRecord } from '../../shared/schema'

export interface StreamProgress {
  filesProcessed: number
  recordsWritten: number
  currentFile: string
}

export type ProgressCallback = (progress: StreamProgress) => void
export type Parser = (buffer: Buffer) => DataRecord[]

interface Route {
  pattern: string
  parser: Parser
}

const routes: Route[] = []

export function registerParser(pattern: string, parser: Parser): void {
  routes.push({ pattern, parser })
}

function matchPattern(filename: string, pattern: string): boolean {
  const f = filename.replace(/\\/g, '/')
  const p = pattern.replace(/\\/g, '/')

  // Convert glob to regex: ** = any path, * = within segment, ? = single char
  const regexStr = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // escape regex specials
    .replace(/\*\*/g, '\x00')               // temporarily mark **
    .replace(/\*/g, '[^/]*')                // * = within-segment wildcard
    .replace(/\x00/g, '.*')                 // ** = cross-segment wildcard
    .replace(/\?/g, '[^/]')

  return new RegExp(`(^|/)${regexStr}$`, 'i').test(f)
}

/**
 * Route a ZIP entry filename to its parser.
 * Returns parsed DataRecord[] or null if no parser is registered for this file.
 */
export function routeEntry(filename: string, buffer: Buffer): DataRecord[] | null {
  for (const route of routes) {
    if (matchPattern(filename, route.pattern)) {
      return route.parser(buffer)
    }
  }
  return null
}
