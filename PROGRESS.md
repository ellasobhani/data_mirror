# DataMirror — Daily Progress Log

---

## 2026-04-13

### Phase Status

| Phase | Title | Status | Notes |
|-------|-------|--------|-------|
| 0 | Electron skeleton | ✅ Complete | BrowserWindow, tRPC IPC, SQLite WAL, seed data, React 18 + electron-vite build |
| 1 | Streaming ingestion core | 🔄 In Progress | Pipeline built; LinkedIn bypasses it (still uses `unzipSync`) |
| 2 | Basic dashboard | 🔄 In Progress | Records list + platform filter done; no timeline chart, no search, no pagination UI |
| 3 | More parsers (Google Takeout, Meta) | 🔄 In Progress | 1 of ~10 Google sub-parsers done (`MyActivity/Search/MyActivity.json` only) |
| 4 | Credential storage + Playwright agent | ⬜ Not Started | `keytar` in deps, no usage; no Playwright anywhere |
| 5 | Email monitor + auto-download (IMAP) | ⬜ Not Started | `imapflow` in deps, no implementation |
| 6 | All remaining platforms (Meta, Apple, X, Amazon, Spotify, TikTok) | ⬜ Not Started | Reclaim links exist but no parsers |
| 7 | Identity Mirror view | ⬜ Not Started | No component; Reclaim AI plan button is `disabled` stub |
| 8 | AI summarization + chat (Claude API, FTS5) | 🔄 In Progress | Gemini lenses (3) working; `@anthropic-ai/sdk` imported but unused; no FTS5 table; no chat UI |
| 9 | Polish + resilience | ⬜ Not Started | — |

---

### Recent Completed Work (from `git log --oneline -20`)

```
8f5e998 initial commit
```

The entire codebase shipped in a single commit. Completed work includes:

- **Electron skeleton** (`electron/main.ts`): `BrowserWindow` with `titleBarStyle: 'hiddenInset'`, `contextIsolation: true`, `electron-trpc` IPC handler, `seedFakeRecords()` on startup.
- **SQLite schema** (`electron/db/schema.ts`): `records`, `platform_status`, `ai_summaries`, `lens_results`, `reclaim_actions` tables. Migration runner in `getDb()` handles schema evolution (e.g. `lens_quality` column).
- **Streaming ZIP pipeline** (`electron/ingest/stream-download.ts`): `fs.createReadStream` → `fflate Unzip` (streaming decompression) → `routeEntry()` dispatcher → per-entry `better-sqlite3` transaction. Peak memory ~10 MB by design.
- **Parser registry** (`electron/ingest/router.ts`): glob-pattern dispatch via `registerParser()` + `routeEntry()`. Supports `**` and `*` wildcards.
- **Google Search History parser** (`electron/ingest/parsers/google/search-history.ts`): parses `MyActivity/Search/MyActivity.json`, strips "Searched for " prefix, registered as `**/My Activity/Search/MyActivity.json`.
- **LinkedIn ingestor** (`electron/ingest/linkedin.ts`): parses `connections.csv`, `messages.csv`, `reactions.csv`, `comments.csv`, `shares.csv`. Full CSV parser with quote/multiline handling. Strips HTML from message bodies.
- **Gemini AI lenses** (`electron/ai/lenses.ts`, `electron/ai/aggregate.ts`): 3 lenses (marketer / network / relationships). `aggregateLinkedIn()` pre-computes all ratios before sending to Gemini — no arithmetic delegated to the model. `lens_results` cached in SQLite.
- **Insights UI** (`src/Insights.tsx`): Custom markdown renderer, scan-line animation during generation, cache-aware `REGENERATE` / `ANALYZE ▶` state, `NO MESSAGE CONTENT TRANSMITTED` footer.
- **Reclaim tab** (`src/pages/Reclaim.tsx` + `electron/reclaim/deletion-requests.ts`): Static GDPR/CCPA action links for LinkedIn, Google, Meta, Reddit, X. `reclaim_actions` table in DB for future tracking (no tRPC routes yet).
- **tRPC router** (`electron/ipc/router.ts`): `ping`, `getRecords`, `getPlatformStatuses`, `showOpenDialog`, `showMultiOpenDialog`, `ingestGoogle`, `ingestLinkedin`, `getGeminiKey`, `setGeminiKey`, `getCachedLens`, `generateLens`.

---

### Top 3 Tasks for Today's Session

#### 1. Port LinkedIn ingestor into the streaming parser registry [CRITICAL — unblocks Phase 1]

**File:** `electron/ingest/linkedin.ts`
**Problem:** `ingestLinkedin()` at line 77 calls `fs.readFileSync(zipPath)` followed by `unzipSync()` — loading the entire ZIP buffer into memory synchronously. This violates the core streaming-first principle.
**Fix:** Split `linkedin.ts` into per-file parsers and register them with `registerParser()` in `ingest/router.ts`:
```
registerParser('**/Connections.csv', parseLinkedInConnections)
registerParser('**/messages.csv', parseLinkedInMessages)
registerParser('**/Reactions.csv', parseLinkedInReactions)
registerParser('**/Comments.csv', parseLinkedInComments)
registerParser('**/Shares.csv', parseLinkedInShares)
```
Then update `router.ts:66` (`ingestLinkedin` procedure) to call `streamIngestFile(input.path)` instead of `ingestLinkedin(input.path)`. The `ingestLinkedin` import and the `DELETE FROM records WHERE platform = 'linkedin'` destructive pre-wipe (line 155) must both be removed.
**Side-effect:** The `ingestLinkedin` import in `electron/ipc/router.ts:6` becomes dead and should be removed.

#### 2. Add 4–6 critical Google Takeout sub-parsers [unblocks Phase 3]

**File:** `electron/ingest/parsers/google/` (currently only `search-history.ts`)
**Priority parsers to add:**
- `youtube-history.ts` → `**/My Activity/YouTube/MyActivity.json` → category `media`
- `location-history.ts` → `**/Location History/Records.json` (or `Semantic Location History/**/*.json`) → category `location`
- `chrome-history.ts` → `**/Chrome/BrowserHistory.json` → category `browse`
- `maps-search.ts` → `**/My Activity/Maps/MyActivity.json` → category `search`

Each needs to be imported in `electron/ipc/router.ts` (alongside the existing `import '../ingest/parsers/google/search-history'` at line 11) so `registerParser()` runs at startup.

**Why now:** The streaming pipeline already handles Google Takeout ZIPs. Each new parser is ~30–50 lines and immediately unlocks real data density for dashboard and AI features downstream.

#### 3. Migrate Gemini API key to `keytar` secure storage [architectural risk]

**File:** `electron/ai/gemini.ts`
**Problem:** `saveApiKey()` at line 23 writes the key to `config.json` in plaintext (userData directory). `keytar` (`^7.9.0`) is already in `package.json` but unused.
**Fix:** Replace `readConfig()`/`writeConfig()` in `gemini.ts` with:
```typescript
import keytar from 'keytar'
const SERVICE = 'data-mirror'
const ACCOUNT = 'gemini-api-key'

export async function saveApiKey(key: string): Promise<void> {
  await keytar.setPassword(SERVICE, ACCOUNT, key)
}
export async function loadApiKey(): Promise<string | null> {
  const envKey = import.meta.env.MAIN_VITE_GEMINI_API_KEY as string | undefined
  if (envKey) return envKey
  return keytar.findPassword(SERVICE)
}
```
This requires making `setGeminiKey` and `getGeminiKey` in `electron/ipc/router.ts` async — they already call `await` so the change is minimal. The plaintext `config.json` should be deleted on first keytar write for migration safety.

---

### Architectural Risks & Blockers

**Risk 1 — LinkedIn parser violates streaming contract (HIGH)**
`electron/ingest/linkedin.ts:77–78` reads and decompresses the entire ZIP synchronously before the `streamIngestFile` pipeline even exists. A 100 MB LinkedIn export will load fully into Node.js heap. With large exports this could exceed Electron's memory limit. This is the single highest-priority fix.

**Risk 2 — No live progress events from main → renderer (MEDIUM)**
`streamIngestFile` accepts an `onProgress?: ProgressCallback` parameter (`electron/ingest/stream-download.ts:17`) but `router.ts:57–64` ignores it. The UI shows only static "Importing X ZIPs…" during ingest. For large Takeout exports (multi-GB, thousands of files), the user sees no feedback for minutes. Electron `mainWindow.webContents.send()` or tRPC subscriptions are needed here.

**Risk 3 — `queries.ts` is dead code creating a split-brain (LOW)**
`electron/db/queries.ts` defines `getLensResult()` and `saveLensResult()` but `electron/ipc/router.ts:86–107` re-implements the same SQL inline. Both exist in the codebase. `rateLens()` and the `reclaim_actions` CRUD in `queries.ts` are also unused — no tRPC routes expose them. This will cause confusion when the Reclaim tracking feature is built.

**Risk 4 — Ghost network uniqueSenderCount inconsistency (LOW)**
`PROMPTS.md` (line 108) documents that `uniqueSenderCount` is "capped at 20" — but `electron/ai/aggregate.ts:168` computes `Object.keys(senderCt).length` before the slice, so it is actually accurate. The documentation is wrong, not the code. Fix the PROMPTS.md to reflect reality before this causes a real bug when someone "fixes" the correct code based on the wrong doc.

**Risk 5 — No FTS5 table for Phase 8 search (MEDIUM)**
`electron/db/schema.ts` has no `CREATE VIRTUAL TABLE records_fts USING fts5(...)`. The Phase 8 AI chat requires full-text search over record titles and bodies. This table needs to be added as a migration before record volume grows large, because backfilling an FTS5 index on millions of rows is slow and must be done as a migration job with progress tracking.

**Risk 6 — Gemini API key in plaintext (MEDIUM)**
As noted in Task 3 above. The Gemini key in `config.json` at `app.getPath('userData')` is readable by any process on the machine with user-level access. `keytar` is already a dependency — using it is a one-file change.
