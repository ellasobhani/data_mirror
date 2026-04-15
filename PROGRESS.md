# DataMirror — Daily Progress Log

---

## 2026-04-15

### Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Electron skeleton | ✅ Complete | Electron 31 + React 18 + TypeScript; tRPC IPC via electron-trpc; SQLite via better-sqlite3; 3-tab UI (Records / Insights / Reclaim) |
| 1 — Streaming ingestion core | 🔄 In Progress | Streaming framework built (`stream-download.ts` + `ingest/router.ts`); **LinkedIn still uses sync `fs.readFileSync` + `unzipSync` path** — violates streaming-first mandate; only 1 parser registered (Google Search History) |
| 2 — Basic dashboard | 🔄 In Progress | Records list with platform filter exists in `App.tsx`; **no timeline charts, no `@observablehq/plot` usage anywhere, no search input** |
| 3 — More parsers (Google Takeout, Meta) | ⬜ Not Started | Only `electron/ingest/parsers/google/search-history.ts` exists; YouTube, Chrome History, Location History, Meta all missing |
| 4 — Credential storage + Playwright | ⬜ Not Started | `keytar` in `package.json` deps but **never imported**; Gemini key stored in plain JSON (`config.json` in userData), not keytar; no Playwright dep |
| 5 — Email monitor (IMAP/imapflow) | ⬜ Not Started | `imapflow` in `package.json` deps but **zero code written** |
| 6 — Remaining platforms | ⬜ Not Started | No parsers for Meta, Apple, X, Amazon, Spotify, or TikTok |
| 7 — Identity Mirror view | ⬜ Not Started | No UI or data model |
| 8 — AI summarization + chat | 🔄 In Progress | Gemini lenses working for LinkedIn (3 lenses: marketer/network/relationships in `electron/ai/lenses.ts`); `@anthropic-ai/sdk` is a dep but **never imported**; no FTS5 in schema; no streaming AI; no chat interface |
| 9 — Polish + resilience | ⬜ Not Started | |

---

### Recent Commits (git log -20)

- `8f5e998` — initial commit *(only commit; all work landed in a single squash)*

---

### Top 3 Tasks for Today's Session

#### 1. Port LinkedIn ingestion to the streaming `registerParser()` framework [UNBLOCKS PHASE 1]

**Why:** `electron/ingest/linkedin.ts:1–3` calls `fs.readFileSync` + `unzipSync` — the entire ZIP is read into memory synchronously before a single record is written. A 500 MB LinkedIn export will spike RAM and block the main process. The streaming framework (`stream-download.ts` + `ingest/router.ts`) is already in place; LinkedIn just hasn't been ported.

**How:** Create `electron/ingest/parsers/linkedin/index.ts`. Move the five parser branches (connections, messages, reactions, comments, shares) into individual `registerParser()` calls:
```
registerParser('**/Connections.csv',  parseLinkedInConnections)
registerParser('**/messages.csv',     parseLinkedInMessages)
registerParser('**/Reactions.csv',    parseLinkedInReactions)
registerParser('**/Comments.csv',     parseLinkedInComments)
registerParser('**/Shares.csv',       parseLinkedInShares)
```
Then import this file in `electron/ipc/router.ts` (alongside the Google import at line 11), and change the `ingestLinkedin` IPC handler to call `streamIngestFile(input.path)` instead of the old `ingestLinkedin()` function. The sync path in `linkedin.ts` can then be deleted.

**Risk:** LinkedIn ZIP uses `LinkedInExport_*.zip` naming — confirm the CSV filenames match the glob patterns exactly before removing the old path.

---

#### 2. Add 3 Google Takeout sub-parsers using the existing template [STARTS PHASE 3]

**Why:** The `registerParser` mechanism is proven; `search-history.ts` is a clean 49-line template. Three high-value Google data types are missing: Chrome browsing history, YouTube watch history, and Location history. Each is < 30 lines of new code.

**Files to create:**
- `electron/ingest/parsers/google/chrome-history.ts` — pattern: `**/Chrome/History/BrowserHistory.json`, field: `url`, `title`, `time_usec` (microseconds since epoch ÷ 1000 → ms)
- `electron/ingest/parsers/google/youtube-history.ts` — pattern: `**/YouTube and YouTube Music/history/watch-history.json`, fields: `title`, `titleUrl`, `time`
- `electron/ingest/parsers/google/location-history.ts` — pattern: `**/Location History/Records.json`, shape: `{ locations: [{ latitudeE7, longitudeE7, timestamp }] }`, category: `location`

Import all three in `electron/ipc/router.ts` alongside the existing search-history import (line 11).

---

#### 3. Wire `onProgress` callback to IPC for live import feedback [UNBLOCKS PHASE 2 UX]

**Why:** `streamIngestFile()` already accepts an `onProgress?: ProgressCallback` parameter, but `ipc/router.ts:59` never passes one — so `App.tsx` shows a static "Importing N ZIP(s)..." string with no feedback while potentially thousands of records are processed. For large Google Takeouts this looks frozen.

**How:** In `electron/ipc/router.ts`, the `ingestGoogle` mutation needs to forward progress back to the renderer. The cleanest pattern is tRPC subscription or an Electron `webContents.send` side-channel. Simplest viable fix: emit a named IPC event (`ingest-progress`) from the `onProgress` callback via `mainWindow.webContents.send('ingest-progress', progress)` and listen for it in `App.tsx` with `window.electron.ipcRenderer.on`. Update `App.tsx:83` to show `currentFile` and a running record count.

---

### Architectural Risks & Blockers

| Risk | Location | Severity |
|------|----------|----------|
| **Sync ZIP read in LinkedIn ingestion** — entire archive held in memory | `electron/ingest/linkedin.ts:1–3` (`readFileSync` + `unzipSync`) | High — will OOM on large exports; violates streaming-first core principle |
| **`platform_status` table is never written to** — ingestion completes but all platforms remain `idle`; `getPlatformStatuses` query returns nothing useful | `electron/db/schema.ts:22–29`, `electron/db/index.ts:116–134` | Medium — the status feature is dead code; no import state visible to UI |
| **`@anthropic-ai/sdk` dep unused** — package.json includes `@anthropic-ai/sdk ^0.36.3` but it is never imported anywhere; Phase 8 currently uses only Gemini | `package.json` | Low — dead dep adds ~5 MB to build; signals Phase 8 AI plan is undecided |
| **`gemini.ts:39` uses non-streaming `generateContent`** — the planned Phase 8 chat UX requires token-streaming; current model call returns the full response only when complete | `electron/ai/gemini.ts:35–42` | Medium — will need refactor to `generateContentStream` before chat is viable |
| **No FTS5 virtual table** — schema.ts has no `CREATE VIRTUAL TABLE records_fts USING fts5(...)` ; full-text search across millions of records without FTS5 will be table-scanned | `electron/db/schema.ts` | High for Phase 8 — add the FTS5 table + triggers now before record count grows |
| **`Reclaim.tsx` imports from `electron/` process boundary** — `src/pages/Reclaim.tsx:2–3` imports directly from `electron/reclaim/deletion-requests.ts`; works now because the file is pure data, but will break the renderer bundle if any Node.js API is ever added | `src/pages/Reclaim.tsx:2–3` | Low now, High as Phase 4 adds automation; move `PLATFORM_RECLAIM_OPTIONS` to `shared/` |
| **`seedFakeRecords()` called every startup** — `main.ts:41` seeds fake records (meta/social, spotify/media, amazon/purchase) on every cold start; these synthetic rows appear in the Records tab and in the Gemini `aggregateLinkedIn()` query until real data is imported | `electron/main.ts:41`, `electron/db/index.ts:23–84` | Low — guard is `if (count > 0) return` so it's safe, but the fake data is misleading in demos |
