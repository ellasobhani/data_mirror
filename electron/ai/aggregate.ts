import { getDb } from '../db/index'

export interface ConnectionStats {
  total: number
  topCompanies: Array<{ company: string; count: number }>
  seniorityBreakdown: Record<string, number>
  industryBreakdown: Record<string, number>
  byYear: Array<{ year: number; count: number }>
  sampleTitles: string[]
}

export interface MessageStats {
  total: number
  inbound: number
  outbound: number
  recruiterCount: number
  uniqueSenderCount: number
  topSenders: Array<{ name: string; count: number }>
  topConversationTitles: string[]
  byMonth: Array<{ month: string; count: number }>
}

export interface LinkedInAggregate {
  userName: string
  connections: ConnectionStats
  messages: MessageStats
}

function inferSeniority(pos: string): string {
  const p = pos.toLowerCase()
  if (/\b(ceo|cto|cfo|coo|chief|president|founder|co-founder)\b/.test(p)) return 'C-Suite / Founder'
  if (/\b(vp|vice president|svp|evp)\b/.test(p)) return 'VP'
  if (/\b(director|head of)\b/.test(p)) return 'Director'
  if (/\b(manager|lead|principal|staff)\b/.test(p)) return 'Manager / Lead'
  if (/\b(senior|sr\.?)\b/.test(p)) return 'Senior IC'
  if (/\b(junior|jr\.?|associate|intern|entry)\b/.test(p)) return 'Junior / Entry'
  return 'Mid-Level IC'
}

function inferIndustry(pos: string, co: string): string {
  const t = `${pos} ${co}`.toLowerCase()
  if (/\b(software|engineer|developer|swe|ml|ai|data scientist|devops|cloud|backend|frontend|fullstack)\b/.test(t)) return 'Software / Engineering'
  if (/\b(product manager|pm|product lead)\b/.test(t)) return 'Product'
  if (/\b(design|ux|ui|creative|brand)\b/.test(t)) return 'Design / Creative'
  if (/\b(sales|account exec|revenue|business development|bd)\b/.test(t)) return 'Sales / BD'
  if (/\b(marketing|growth|seo|content|social media|demand gen)\b/.test(t)) return 'Marketing'
  if (/\b(finance|fintech|banking|invest|capital|fund|trading|analyst)\b/.test(t)) return 'Finance'
  if (/\b(doctor|physician|nurse|health|medical|pharma|biotech|clinical)\b/.test(t)) return 'Healthcare / Biotech'
  if (/\b(consult|strategy|mckinsey|bain|bcg|deloitte|pwc|kpmg|ey)\b/.test(t)) return 'Consulting'
  if (/\b(law|legal|attorney|counsel|compliance)\b/.test(t)) return 'Legal'
  if (/\b(research|scientist|phd|professor|university|academia|lab)\b/.test(t)) return 'Research / Academia'
  if (/\b(recruit|talent|hr|human resources|people ops)\b/.test(t)) return 'HR / Recruiting'
  if (/\b(founder|startup|venture|vc|angel|entrepreneur)\b/.test(t)) return 'Startup / VC'
  if (/\b(operations|ops|supply chain|logistics)\b/.test(t)) return 'Operations'
  return 'Other'
}

const RECRUITER_RE = /\bopportunity\b|\bopening\b|\brole\b|\bposition\b|\brecruiter\b|\brecruiting\b|\bhiring\b|\btalent\b|\bcandidate\b|\bjob\b|\bcareer\b|\bmba\b|\bprogram\b/i

export function aggregateLinkedIn(): LinkedInAggregate {
  const db = getDb()

  // ── Connections ──────────────────────────────────────────────
  type ConnRow = { title: string; body: string; metadata: string; timestamp: number }
  const connRows = db.prepare(`
    SELECT title, body, metadata, timestamp
    FROM records WHERE platform='linkedin' AND category='social'
  `).all() as ConnRow[]

  const companyCt: Record<string, number> = {}
  const seniorityCt: Record<string, number> = {}
  const industryCt: Record<string, number> = {}
  const yearCt: Record<number, number> = {}
  const sampleTitles: string[] = []
  let connectionCount = 0

  for (const row of connRows) {
    const meta = JSON.parse(row.metadata || '{}')
    const company = (meta.company || '').trim()
    const position = (meta.position || '').trim()

    // Skip reactions, comments, and shares — they share category='social' but have no company/position
    if (!company && !position) continue
    connectionCount++

    if (company) companyCt[company] = (companyCt[company] || 0) + 1

    const seniority = inferSeniority(position)
    seniorityCt[seniority] = (seniorityCt[seniority] || 0) + 1

    const industry = inferIndustry(position, company)
    industryCt[industry] = (industryCt[industry] || 0) + 1

    if (row.timestamp > 0) {
      const year = new Date(row.timestamp).getFullYear()
      yearCt[year] = (yearCt[year] || 0) + 1
    }

    if (position && sampleTitles.length < 50 && !sampleTitles.includes(position)) {
      sampleTitles.push(position)
    }
  }

  // ── Messages ─────────────────────────────────────────────────
  type MsgRow = { title: string; metadata: string; timestamp: number }
  const msgRows = db.prepare(`
    SELECT title, metadata, timestamp
    FROM records WHERE platform='linkedin' AND category='message'
    ORDER BY timestamp DESC
  `).all() as MsgRow[]

  // Infer the user's own name from the "TO" field of inbound messages
  let userName = 'You'
  for (const row of msgRows) {
    const m = JSON.parse(row.metadata || '{}')
    if (m.to && m.from && m.from !== m.to) { userName = m.to; break }
  }

  const senderCt: Record<string, number> = {}
  const monthCt: Record<string, number> = {}
  const convTitles = new Set<string>()
  let inbound = 0
  let outbound = 0
  let recruiterCount = 0

  for (const row of msgRows) {
    const meta = JSON.parse(row.metadata || '{}')
    const from = (meta.from || '').trim()
    const isInbound = from && from !== userName

    if (isInbound) {
      inbound++
      senderCt[from] = (senderCt[from] || 0) + 1
    } else {
      outbound++
    }

    const title = (row.title || '').trim()
    if (title && title !== '(message)') convTitles.add(title)
    if (RECRUITER_RE.test(title)) recruiterCount++

    if (row.timestamp > 0) {
      const d = new Date(row.timestamp)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthCt[key] = (monthCt[key] || 0) + 1
    }
  }

  return {
    userName,
    connections: {
      total: connectionCount,
      topCompanies: Object.entries(companyCt)
        .sort((a, b) => b[1] - a[1]).slice(0, 25)
        .map(([company, count]) => ({ company, count })),
      seniorityBreakdown: seniorityCt,
      industryBreakdown: industryCt,
      byYear: Object.entries(yearCt)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([year, count]) => ({ year: Number(year), count })),
      sampleTitles,
    },
    messages: {
      total: msgRows.length,
      inbound,
      outbound,
      recruiterCount,
      uniqueSenderCount: Object.keys(senderCt).length,
      topSenders: Object.entries(senderCt)
        .sort((a, b) => b[1] - a[1]).slice(0, 20)
        .map(([name, count]) => ({ name, count })),
      topConversationTitles: Array.from(convTitles).slice(0, 40),
      byMonth: Object.entries(monthCt)
        .sort((a, b) => a[0].localeCompare(b[0])).slice(-24)
        .map(([month, count]) => ({ month, count })),
    },
  }
}
