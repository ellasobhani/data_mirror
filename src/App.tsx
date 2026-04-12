import { useState, useEffect } from 'react'
import { trpc } from './trpc'
import type { DataRecord } from '../shared/schema'
import Insights from './Insights'
import Reclaim from './pages/Reclaim'

function formatTime(ts: number): string {
  if (!ts) return '(no date)'
  return new Date(ts).toLocaleString()
}

function PlatformBadge({ platform }: { platform: string }) {
  return <span className={`platform-badge platform-${platform}`}>{platform}</span>
}

function CategoryBadge({ category }: { category: string }) {
  return <span className="category-badge">{category}</span>
}

const PLATFORMS = ['all', 'linkedin', 'google', 'meta', 'spotify', 'amazon']
type Tab = 'records' | 'insights' | 'reclaim'

export default function App() {
  const [tab, setTab] = useState<Tab>('records')
  const [records, setRecords] = useState<DataRecord[]>([])
  const [total, setTotal] = useState(0)
  const [ping, setPing] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [importStatus, setImportStatus] = useState<string>('')
  const [platform, setPlatform] = useState<string>('all')

  async function refreshRecords(p = platform) {
    const result = await trpc.getRecords.query({
      limit: 50,
      platform: p === 'all' ? undefined : p,
    })
    setRecords(result.records)
    setTotal(result.total)
  }

  useEffect(() => {
    async function load() {
      try {
        const pong = await trpc.ping.query()
        setPing(`${pong.message} (${new Date(pong.timestamp).toLocaleTimeString()})`)
        await refreshRecords('all')
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handlePlatformChange(p: string) {
    setPlatform(p)
    await refreshRecords(p)
  }

  async function handleImportLinkedin() {
    try {
      setImportStatus('Opening file picker...')
      const filePath = await trpc.showOpenDialog.query()
      if (!filePath) { setImportStatus(''); return }
      setImportStatus('Importing...')
      const { count } = await trpc.ingestLinkedin.mutate({ path: filePath })
      setImportStatus(`Imported ${count} LinkedIn records`)
      await refreshRecords()
    } catch (err) {
      setImportStatus(`Import failed: ${String(err)}`)
    }
  }

  async function handleImportGoogle() {
    try {
      setImportStatus('Select your Google Takeout ZIP(s)...')
      const paths = await trpc.showMultiOpenDialog.query()
      if (!paths.length) { setImportStatus(''); return }
      setImportStatus(`Importing ${paths.length} ZIP(s)...`)
      const { filesProcessed, recordsWritten } = await trpc.ingestGoogle.mutate({ paths })
      setImportStatus(`Google: ${recordsWritten} records from ${filesProcessed} files`)
      await refreshRecords()
    } catch (err) {
      setImportStatus(`Import failed: ${String(err)}`)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Data Mirror</h1>
        <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
          {ping || (loading ? 'connecting...' : 'IPC failed')}
        </span>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {(['records', 'insights', 'reclaim'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--fg)' : '2px solid transparent',
              color: tab === t ? 'var(--fg)' : 'var(--muted)',
              fontWeight: tab === t ? 600 : 400,
              marginBottom: '-1px',
            }}
          >
            {t === 'records' ? 'Records' : t === 'insights' ? 'Insights ✦' : 'Reclaim'}
          </button>
        ))}
      </div>

      {/* Records tab */}
      {tab === 'records' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <button onClick={handleImportLinkedin} style={{ padding: '6px 14px', cursor: 'pointer' }}>
              Import LinkedIn ZIP
            </button>
            <button onClick={handleImportGoogle} style={{ padding: '6px 14px', cursor: 'pointer' }}>
              Import Google Takeout
            </button>
            {importStatus && (
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{importStatus}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => handlePlatformChange(p)}
                style={{
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  opacity: platform === p ? 1 : 0.45,
                  fontWeight: platform === p ? 600 : 400,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ color: 'var(--red)', padding: '12px', background: '#2a1a1a', borderRadius: '6px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '12px', color: 'var(--muted)', fontSize: '12px' }}>
            {loading ? 'Loading...' : `${total} records`}
          </div>

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {records.map(r => (
              <li
                key={r.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <PlatformBadge platform={r.platform} />
                  <CategoryBadge category={r.category} />
                  <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: '12px' }}>
                    {formatTime(r.timestamp)}
                  </span>
                </div>
                <div style={{ fontWeight: 500, fontSize: '13px' }}>{r.title ?? '(untitled)'}</div>
                {r.url && (
                  <div style={{ color: 'var(--muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.url}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Insights tab */}
      {tab === 'insights' && <Insights />}

      {/* Reclaim tab */}
      {tab === 'reclaim' && <Reclaim />}
    </div>
  )
}
