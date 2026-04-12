import { useState } from 'react'
import type { PlatformReclaimOptions, ReclaimActionDefinition } from '../../electron/reclaim/deletion-requests'
import { PLATFORM_RECLAIM_OPTIONS } from '../../electron/reclaim/deletion-requests'

const TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  'data-deletion':   { bg: '#3a1a1a', color: '#ff6b6b', label: 'deletion' },
  'opt-out-ads':     { bg: '#2a3a1a', color: '#a3ff6b', label: 'opt-out ads' },
  'opt-out-sale':    { bg: '#2a3a1a', color: '#a3ff6b', label: 'opt-out sale' },
  'download-copy':   { bg: '#1a2a3a', color: '#6ba3ff', label: 'download' },
  'privacy-settings':{ bg: '#3a2a1a', color: '#ffb366', label: 'settings' },
}

function ActionRow({ action }: { action: ReclaimActionDefinition }) {
  const [opened, setOpened] = useState(false)
  const meta = TYPE_COLORS[action.type] ?? TYPE_COLORS['privacy-settings']

  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{action.label}</span>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: '4px',
            background: meta.bg,
            color: meta.color,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}>
            {meta.label}
          </span>
          {action.estimatedDays && (
            <span style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>
              ~{action.estimatedDays}d
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
          {action.description}
        </div>
      </div>
      <button
        onClick={() => {
          window.open(action.url, '_blank', 'noopener,noreferrer')
          setOpened(true)
        }}
        style={{
          padding: '6px 14px',
          fontSize: '12px',
          cursor: 'pointer',
          flexShrink: 0,
          opacity: opened ? 0.55 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {opened ? 'Opened ✓' : 'Open →'}
      </button>
    </div>
  )
}

function PlatformCard({ platform }: { platform: PlatformReclaimOptions }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '12px',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          background: 'var(--surface)',
          border: 'none',
          textAlign: 'left',
          gap: '12px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '3px' }}>
            {platform.displayName}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.4' }}>
            {platform.tagline}
          </div>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px', flexShrink: 0 }}>
          {platform.actions.length} actions {expanded ? '▼' : '▶'}
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 20px 4px', background: 'var(--bg)' }}>
          {platform.actions.map((action, i) => (
            <ActionRow key={i} action={action} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Reclaim() {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
          Direct links to data deletion, opt-out, and privacy settings for the platforms tracking you.
          Export your data before deleting — most platforms have a 30-day grace period.
        </p>
      </div>

      {PLATFORM_RECLAIM_OPTIONS.map(platform => (
        <PlatformCard key={platform.platform} platform={platform} />
      ))}

      {/* Reclaim lens placeholder */}
      <div style={{
        marginTop: '24px',
        padding: '16px 20px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
            Reclaim Plan ✦
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5' }}>
            Run the AI lens to get a prioritized action plan based on your actual data profile —
            which platforms hold the most sensitive data, which deletions are worth the effort, what to do first.
          </div>
        </div>
        <button disabled style={{ padding: '8px 16px', cursor: 'not-allowed', opacity: 0.4, flexShrink: 0, fontSize: '13px' }}>
          Coming soon
        </button>
      </div>
    </div>
  )
}
