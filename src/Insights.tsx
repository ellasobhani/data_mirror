import { useState, useEffect } from 'react'
import { trpc } from './trpc'

const AMBER = '#c8820a'
const AMBER_DIM = 'rgba(200, 130, 10, 0.08)'
const AMBER_BORDER = 'rgba(200, 130, 10, 0.25)'
const MONO = "'IBM Plex Mono', 'Courier New', monospace"

const LENSES = [
  {
    id: 'marketer' as const,
    code: 'FILE-001',
    icon: '◈',
    title: "The Marketer's Playbook",
    subtitle: 'What LinkedIn knows about you — and how they sell it',
    description: 'See yourself through an advertiser\'s eyes. This is the targeting file LinkedIn builds on you, and exactly how it\'s used against you.',
    tag: 'AD PROFILE',
  },
  {
    id: 'network' as const,
    code: 'FILE-002',
    icon: '◎',
    title: 'Network DNA',
    subtitle: 'What your connection graph says about who you are',
    description: 'Your professional identity is encoded in who you\'ve chosen to connect with. Here\'s what that data actually reveals.',
    tag: 'GRAPH ANALYSIS',
  },
  {
    id: 'relationships' as const,
    code: 'FILE-003',
    icon: '◉',
    title: 'Relationship Reality',
    subtitle: 'Who actually shows up — and who\'s just a number',
    description: 'You have connections. You have conversations. These are not the same thing. Here\'s the gap.',
    tag: 'BEHAVIORAL',
  },
]

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0; let match: RegExpExecArray | null; let i = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(<strong key={i++} style={{ color: 'var(--text)', fontWeight: 600 }}>{match[1]}</strong>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderMarkdown(text: string): JSX.Element {
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let key = 0

  for (const line of lines) {
    const t = line.trim()

    if (!t) {
      elements.push(<div key={key++} style={{ height: '10px' }} />)
    } else if (t.startsWith('## ')) {
      elements.push(
        <div key={key++} style={{ marginTop: '28px', marginBottom: '12px' }}>
          <div style={{
            fontFamily: MONO,
            fontSize: '11px',
            color: AMBER,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            {t.slice(3)}
          </div>
          <div style={{ height: '1px', background: `linear-gradient(to right, ${AMBER_BORDER}, transparent)` }} />
        </div>
      )
    } else if (t.startsWith('### ')) {
      elements.push(
        <p key={key++} style={{
          fontFamily: MONO,
          fontSize: '11px',
          color: AMBER,
          letterSpacing: '0.08em',
          marginTop: '16px',
          marginBottom: '6px',
          opacity: 0.8,
        }}>
          ▸ {t.slice(4)}
        </p>
      )
    } else if (t.startsWith('- ') || t.startsWith('* ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: '10px', marginBottom: '6px', paddingLeft: '4px' }}>
          <span style={{ color: AMBER, flexShrink: 0, fontFamily: MONO, fontSize: '12px', marginTop: '1px' }}>—</span>
          <span style={{ fontSize: '13px', lineHeight: '1.65', color: 'var(--text)' }}>{renderInline(t.slice(2))}</span>
        </div>
      )
    } else if (/^\d+\.\s/.test(t)) {
      const num = t.match(/^(\d+)\./)?.[1]
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: '12px', marginBottom: '8px', paddingLeft: '4px' }}>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: AMBER, flexShrink: 0, minWidth: '18px', marginTop: '2px' }}>{num}.</span>
          <span style={{ fontSize: '13px', lineHeight: '1.65' }}>{renderInline(t.replace(/^\d+\.\s/, ''))}</span>
        </div>
      )
    } else if (t.startsWith('**Ad ') || (t.startsWith('**') && t.endsWith('**') && t.length > 4 && !t.slice(2, -2).includes('**'))) {
      elements.push(
        <p key={key++} style={{
          fontSize: '12px',
          fontFamily: MONO,
          color: AMBER,
          letterSpacing: '0.04em',
          marginTop: '12px',
          marginBottom: '4px',
        }}>
          {t.slice(2, -2)}
        </p>
      )
    } else {
      elements.push(
        <p key={key++} style={{ fontSize: '13px', lineHeight: '1.7', marginBottom: '2px', color: '#d0cfc8' }}>
          {renderInline(t)}
        </p>
      )
    }
  }
  return <div style={{ animation: 'result-in 0.35s ease' }}>{elements}</div>
}

// ── LensCard ──────────────────────────────────────────────────────────────────

interface LensCardProps {
  lens: typeof LENSES[0]
  onGenerate: (id: typeof LENSES[0]['id']) => void
  generating: boolean
  cached: { result: string; createdAt: number } | null
}

function StarRating({ lensId }: { lensId: 'marketer' | 'network' | 'relationships' }) {
  const [rating, setRating] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleRate(quality: number) {
    setRating(quality)
    setSaved(false)
    try {
      await trpc.rateLens.mutate({ lensId, quality })
      setSaved(true)
    } catch {
      setRating(null)
    }
  }

  const active = hover ?? rating

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555', letterSpacing: '0.06em' }}>
        RATE
      </span>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => handleRate(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '0 1px',
            fontSize: '14px',
            color: active != null && n <= active ? AMBER : '#444',
            transition: 'color 0.1s',
            lineHeight: 1,
          }}
        >
          ★
        </button>
      ))}
      {saved && (
        <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555', letterSpacing: '0.06em' }}>
          SAVED
        </span>
      )}
    </div>
  )
}

function LensCard({ lens, onGenerate, generating, cached }: LensCardProps) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (cached) setExpanded(true)
  }, [cached])

  const isActive = !!cached || generating

  return (
    <div style={{
      position: 'relative',
      background: isActive ? AMBER_DIM : 'var(--surface)',
      border: `1px solid ${isActive ? AMBER_BORDER : 'var(--border)'}`,
      borderLeft: `3px solid ${isActive ? AMBER : 'var(--border)'}`,
      borderRadius: '2px',
      overflow: 'hidden',
      marginBottom: '12px',
      transition: 'border-color 0.3s, background 0.3s',
    }}>

      {/* Scanning line when generating */}
      {generating && (
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(to right, transparent, ${AMBER}, transparent)`,
          animation: 'scan-line 1.4s ease-in-out infinite',
          zIndex: 2,
          pointerEvents: 'none',
        }} />
      )}

      {/* Header */}
      <div style={{ padding: '18px 22px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: AMBER, letterSpacing: '0.1em', opacity: 0.7 }}>
              {lens.code}
            </span>
            <span style={{
              fontFamily: MONO,
              fontSize: '9px',
              color: isActive ? AMBER : 'var(--muted)',
              letterSpacing: '0.12em',
              padding: '1px 6px',
              border: `1px solid ${isActive ? AMBER_BORDER : 'var(--border)'}`,
              borderRadius: '2px',
              transition: 'all 0.3s',
            }}>
              {lens.tag}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {cached && (
              <button
                onClick={() => setExpanded(e => !e)}
                style={{
                  fontFamily: MONO,
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  background: 'transparent',
                  border: `1px solid var(--border)`,
                  borderRadius: '2px',
                  color: 'var(--muted)',
                }}
              >
                {expanded ? '[ COLLAPSE ]' : '[ VIEW ]'}
              </button>
            )}
            <button
              onClick={() => onGenerate(lens.id)}
              disabled={generating}
              style={{
                fontFamily: MONO,
                fontSize: '10px',
                letterSpacing: '0.1em',
                padding: '4px 12px',
                cursor: generating ? 'default' : 'pointer',
                background: generating ? AMBER_DIM : cached ? 'transparent' : AMBER,
                border: `1px solid ${generating ? AMBER_BORDER : cached ? 'var(--border)' : AMBER}`,
                borderRadius: '2px',
                color: generating ? AMBER : cached ? 'var(--muted)' : '#0f0f0f',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              {generating
                ? <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: AMBER, animation: 'pulse-dot 0.8s ease infinite' }} />
                    ANALYZING
                  </span>
                : cached ? 'REGENERATE' : 'ANALYZE ▶'
              }
            </button>
          </div>
        </div>

        <div style={{
          fontFamily: MONO,
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: 'var(--text)',
          marginBottom: '5px',
          lineHeight: '1.3',
        }}>
          {lens.title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{lens.subtitle}</div>
        <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>{lens.description}</div>
      </div>

      {/* Result */}
      {expanded && cached && (
        <div style={{
          borderTop: `1px solid ${AMBER_BORDER}`,
          padding: '24px 24px 20px',
          background: 'rgba(0,0,0,0.2)',
        }}>
          {renderMarkdown(cached.result)}

          <div style={{
            marginTop: '24px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}>
            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555', letterSpacing: '0.06em' }}>
              GENERATED {new Date(cached.createdAt).toLocaleString().toUpperCase()}
            </span>
            <StarRating lensId={lens.id} />
            <span style={{ fontFamily: MONO, fontSize: '10px', color: '#555', letterSpacing: '0.06em' }}>
              NO MESSAGE CONTENT TRANSMITTED ◈
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Insights ──────────────────────────────────────────────────────────────────

export default function Insights() {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [keyPreview, setKeyPreview] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [cached, setCached] = useState<Record<string, { result: string; createdAt: number } | null>>({})

  useEffect(() => {
    async function load() {
      const { hasKey: hk, keyPreview: kp } = await trpc.getGeminiKey.query()
      setHasKey(hk)
      setKeyPreview(kp)
      const results: Record<string, { result: string; createdAt: number } | null> = {}
      await Promise.all(LENSES.map(async l => {
        results[l.id] = await trpc.getCachedLens.query({ lensId: l.id })
      }))
      setCached(results)
    }
    load()
  }, [])

  async function handleSaveKey() {
    if (!keyInput.trim()) return
    setSavingKey(true)
    try {
      await trpc.setGeminiKey.mutate({ key: keyInput.trim() })
      setHasKey(true)
      setKeyPreview(`${keyInput.slice(0, 6)}...${keyInput.slice(-4)}`)
      setKeyInput('')
    } catch (err) {
      setError(String(err))
    } finally {
      setSavingKey(false)
    }
  }

  async function handleGenerate(lensId: 'marketer' | 'network' | 'relationships') {
    setGenerating(lensId)
    setError('')
    try {
      const { result } = await trpc.generateLens.mutate({ lensId })
      setCached(prev => ({ ...prev, [lensId]: { result, createdAt: Date.now() } }))
    } catch (err) {
      const msg = String(err)
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        const retryMatch = msg.match(/retry in ([\d.]+)s/i)
        const retryMsg = retryMatch ? ` Retry in ${Math.ceil(Number(retryMatch[1]))}s.` : ''
        setError(
          `Gemini free-tier quota exhausted.${retryMsg} ` +
          `To fix: enable billing at console.cloud.google.com (pay-as-you-go, ~$0.10/1M tokens). ` +
          `Or wait until midnight Pacific time for the daily limit to reset.`
        )
      } else {
        setError(`Failed: ${msg}`)
      }
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '6px' }}>
          <h2 style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 600, letterSpacing: '0.15em', color: AMBER }}>
            ◈ INTELLIGENCE / INSIGHTS
          </h2>
          <span style={{ fontFamily: MONO, fontSize: '10px', color: '#444', letterSpacing: '0.08em' }}>
            PLATFORM: LINKEDIN · {LENSES.length} ANALYSES AVAILABLE
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.6', maxWidth: '560px' }}>
          Gemini analyzes your data and surfaces patterns invisible from inside the platform.
          Only metadata is transmitted — no message content, ever.
        </p>
      </div>

      {/* API Key */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--border)',
        borderRadius: '2px',
        padding: '14px 18px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.1em', color: hasKey ? AMBER : 'var(--muted)', marginBottom: '3px' }}>
            {hasKey ? '● GEMINI KEY ACTIVE' : '○ GEMINI KEY REQUIRED'}
          </div>
          <div style={{ fontSize: '11px', color: '#555' }}>
            {hasKey ? keyPreview : 'Required to run analyses. Get one free at aistudio.google.com'}
          </div>
        </div>
        <input
          type="password"
          placeholder={hasKey ? 'Replace key...' : 'AIza...'}
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            fontFamily: MONO,
            width: '190px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '2px',
            color: 'var(--text)',
            letterSpacing: '0.04em',
          }}
        />
        <button
          onClick={handleSaveKey}
          disabled={savingKey || !keyInput.trim()}
          style={{
            fontFamily: MONO,
            fontSize: '10px',
            letterSpacing: '0.1em',
            padding: '6px 14px',
            cursor: 'pointer',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '2px',
            color: 'var(--muted)',
          }}
        >
          {savingKey ? 'SAVING...' : 'SAVE KEY'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          fontFamily: MONO,
          fontSize: '11px',
          letterSpacing: '0.04em',
          color: '#f44336',
          padding: '10px 14px',
          background: 'rgba(244,67,54,0.08)',
          border: '1px solid rgba(244,67,54,0.2)',
          borderLeft: '3px solid #f44336',
          borderRadius: '2px',
          marginBottom: '16px',
          lineHeight: '1.5',
        }}>
          ✕ {error}
        </div>
      )}

      {/* No key state */}
      {!hasKey && (
        <div style={{
          textAlign: 'center',
          padding: '48px 0',
          color: '#444',
          fontFamily: MONO,
          fontSize: '11px',
          letterSpacing: '0.1em',
        }}>
          <div style={{ marginBottom: '8px', fontSize: '24px', opacity: 0.3 }}>◈</div>
          ADD GEMINI KEY TO BEGIN
          <span style={{ animation: 'cursor-blink 1s step-end infinite', marginLeft: '2px' }}>_</span>
        </div>
      )}

      {/* Lens cards */}
      {hasKey && LENSES.map(lens => (
        <LensCard
          key={lens.id}
          lens={lens}
          onGenerate={handleGenerate}
          generating={generating === lens.id}
          cached={cached[lens.id] ?? null}
        />
      ))}
    </div>
  )
}
