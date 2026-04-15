import { registerParser } from '../../router'
import type { DataRecord } from '../../../../shared/schema'

type Row = Record<string, string>

// Proper CSV parser that handles multi-line quoted fields and LinkedIn's
// single-cell preamble rows (first real header row has 3+ fields).
function parseCSV(text: string): Row[] {
  const src = text.replace(/^\uFEFF/, '').replace(/\r/g, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') {
      if (inQuotes && src[i + 1] === '"') { field += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      row.push(field); field = ''
    } else if (ch === '\n' && !inQuotes) {
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += ch
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row) }

  const headerIdx = rows.findIndex(r => r.length >= 3)
  if (headerIdx === -1) return []

  const headers = rows[headerIdx].map(h => h.trim())
  return rows.slice(headerIdx + 1)
    .map(values => {
      const r: Row = {}
      headers.forEach((h, i) => { r[h] = (values[i] ?? '').trim() })
      return r
    })
    .filter(r => Object.values(r).some(v => v !== ''))
}

function parseDate(s: string): number {
  if (!s) return 0
  // LinkedIn messages: "2020-03-15 16:11:00 UTC" → ISO 8601
  const normalized = s.includes(' UTC')
    ? s.replace(' UTC', 'Z').replace(' ', 'T')
    : s
  const d = new Date(normalized)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

function col(row: Row, ...keys: string[]): string {
  for (const k of keys) if (row[k]) return row[k]
  return ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseConnections(buffer: Buffer): DataRecord[] {
  return parseCSV(buffer.toString('utf8')).map(r => {
    const fullName = `${col(r, 'First Name')} ${col(r, 'Last Name')}`.trim()
    const detail = [col(r, 'Position'), col(r, 'Company')].filter(Boolean).join(' at ')
    return {
      platform: 'linkedin' as const,
      category: 'social' as const,
      timestamp: parseDate(col(r, 'Connected On')),
      title: fullName || '(unknown connection)',
      body: detail || undefined,
      url: col(r, 'URL') || undefined,
      metadata: JSON.stringify({ company: col(r, 'Company'), position: col(r, 'Position') }),
    }
  })
}

function parseMessages(buffer: Buffer): DataRecord[] {
  return parseCSV(buffer.toString('utf8')).map(r => {
    const rawContent = col(r, 'CONTENT')
    const content = rawContent ? stripHtml(rawContent) : undefined
    const conversationTitle = col(r, 'CONVERSATION TITLE')
    const from = col(r, 'FROM')
    const title = conversationTitle
      || (from && content ? `${from}: ${content.slice(0, 60)}` : from)
      || '(message)'
    return {
      platform: 'linkedin' as const,
      category: 'message' as const,
      timestamp: parseDate(col(r, 'DATE')),
      title,
      body: content || undefined,
      metadata: JSON.stringify({
        from,
        to: col(r, 'TO'),
        folder: col(r, 'FOLDER'),
        conversationId: col(r, 'CONVERSATION ID'),
      }),
    }
  })
}

function parseReactions(buffer: Buffer): DataRecord[] {
  return parseCSV(buffer.toString('utf8')).map(r => ({
    platform: 'linkedin' as const,
    category: 'social' as const,
    timestamp: parseDate(col(r, 'Date')),
    title: `${col(r, 'Type') || 'Reacted'} on a post`,
    url: col(r, 'Link') || undefined,
    metadata: JSON.stringify({ type: col(r, 'Type') }),
  }))
}

function parseComments(buffer: Buffer): DataRecord[] {
  return parseCSV(buffer.toString('utf8')).map(r => {
    const msg = col(r, 'Message')
    return {
      platform: 'linkedin' as const,
      category: 'social' as const,
      timestamp: parseDate(col(r, 'Date')),
      title: msg.slice(0, 80) || '(comment)',
      body: msg || undefined,
      url: col(r, 'Link') || undefined,
      metadata: JSON.stringify({}),
    }
  })
}

function parseShares(buffer: Buffer): DataRecord[] {
  return parseCSV(buffer.toString('utf8')).map(r => {
    const commentary = col(r, 'ShareCommentary')
    return {
      platform: 'linkedin' as const,
      category: 'social' as const,
      timestamp: parseDate(col(r, 'Date')),
      title: commentary.slice(0, 80) || '(share)',
      body: commentary || undefined,
      url: col(r, 'SharedUrl') || undefined,
      metadata: JSON.stringify({ mediaUrl: col(r, 'MediaUrl') }),
    }
  })
}

// ── Registration ──────────────────────────────────────────────────────────────
// Patterns are matched case-insensitively (see ingest/router.ts matchPattern).
// LinkedIn exports place CSVs at the archive root or inside a named subfolder
// (e.g. Basic_LinkedInDataExport_04-14-2024/). The ** prefix handles both.

registerParser('**/Connections.csv', parseConnections)
registerParser('**/messages.csv',    parseMessages)
registerParser('**/Reactions.csv',   parseReactions)
registerParser('**/Comments.csv',    parseComments)
registerParser('**/Shares.csv',      parseShares)
