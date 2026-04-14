# DataMirror — Daily Progress Review

---

## 2026-04-14

### Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Electron skeleton | ✅ Complete | BrowserWindow, tRPC IPC, SQLite WAL, preload, Vite renderer |
| 1 — Streaming ingestion core | 🔄 In Progress | Streaming pipeline built; LinkedIn uses legacy readFileSync path |
| 2 — Basic dashboard | 🔄 In Progress | Records list + platform filter exist; no charts, no timeline, no search |
| 3 — More parsers | 🔄 In Progress | Only 1 of ~10+ Google sub-parsers registered; no Meta parser |
| 4 — Credential storage + Playwright | ⬜ Not Started | `keytar` installed, zero implementation |
| 5 — Email monitor (IMAP) | ⬜ Not Started | `imapflow` installed, zero implementation |
| 6 — Remaining platforms | ⬜ Not Started | No parsers for Meta, Apple, X, Amazon, Spotify, TikTok |
| 7 — Identity Mirror view | ⬜ Not Started | `ad_profile` category defined in schema, no UI or aggregation |
| 8 — AI summarization + chat | 🔄 In Progress | Gemini lenses complete (3 lenses, full prompts, caching, UI); FTS5 / chat / streaming not started |
| 9 — Polish + resilience | ⬜ Not Started | |

---

### Recent Completed Work (from `git log`)

- **8f5e998** `initial commit` (2026-04-12) — entire codebase landed in a single commit:
  - `electron/main.ts`: BrowserWindow + `createIPCHandler` + `seedFakeRecords` scaffold
  - `electron/db/schema.ts`: `records`, `platform_status`, `ai_summaries`, `lens_results`, `reclaim_actions` tables; migration runner for `lens_quality` column
  - `electron/db/index.ts`: `getDb()` singleton, `seedFakeRecords()`, `getRecords()`, `getAllPlatformStatuses()`
  - `electron/db/queries.ts`: `getLensResult`, `saveLensResult`, `rateLens`, `upsertReclaimAction`, `updateReclaimStatus`, `getReclaimActions`
  - `electron/ingest/router.ts`: glob-pattern parser registry (`registerParser`, `routeEntry`)
  - `electron/ingest/stream-download.ts`: streaming ZIP → fflate → parser → SQLite pipeline (correct streaming design)
  - `electron/ingest/linkedin.ts`: LinkedIn ZIP parser covering connections, messages, reactions, comments, shares (uses `fs.readFileSync` + `unzipSync` — non-streaming)
  - `electron/ingest/parsers/google/search-history.ts`: single Google Takeout parser for `My Activity/Search/MyActivity.json`
  - `electron/ai/gemini.ts`: `saveApiKey`/`loadApiKey` (file-based + env var), `generateWithGemini` (non-streaming)
  - `electron/ai/aggregate.ts`: `aggregateLinkedIn()` — full stats for connections + messages, `inferSeniority`, `inferIndustry`, recruiter regex
  - `electron/ai/lenses.ts`: `fmtData()` with pre-computed ratios + all three prompts (marketer, network, relationships) + `runLens()`
  - `electron/ipc/router.ts`: full tRPC router — ping, getRecords, getPlatformStatuses, showOpenDialog, showMultiOpenDialog, ingestGoogle, ingestLinkedin, getGeminiKey, setGeminiKey, getCachedLens, generateLens
  - `electron/reclaim/deletion-requests.ts`: static reclaim definitions for LinkedIn, Google, Meta, Reddit, X
  - `src/App.tsx`: three-tab shell (Records / Insights ✦ / Reclaim), import buttons, platform filter, records list
  - `src/Insights.tsx`: Gemini key entry, three LensCard components with `renderMarkdown`, generate/cache/expand flow
  - `src/pages/Reclaim.tsx`: expandable PlatformCard list with `window.open` action buttons
  - `shared/schema.ts`: `Platform`, `Category`, `DataRecord`, `PlatformStatus` types

---

### Top 3 Recommended Tasks for Today's Session

#### 1. Add 4–5 critical Google Takeout sub-parsers (unblocks Phase 3, makes Phase 1 genuinely useful)

The streaming pipeline (`stream-download.ts` + `ingest/router.ts`) is complete and correct, but only one parser feeds it. Add these in order of data value:

- `electron/ingest/parsers/google/chrome-history.ts` — pattern `**/Chrome/BrowserHistory.json` — fields: `url`, `title`, `time_usec` (divide by 1000 for ms). Category: `browse`.
- `electron/ingest/parsers/google/maps-activity.ts` — pattern `**/My Activity/Maps/MyActivity.json`. Category: `location`.
- `electron/ingest/parsers/google/youtube-activity.ts` — pattern `**/My Activity/YouTube/MyActivity.json`. Category: `media`.
- `electron/ingest/parsers/google/youtube-watch.ts` — pattern `**/YouTube and YouTube Music/history/watch-history.json`. Category: `media`.

Each follows the exact same pattern as `search-history.ts`: parse JSON array, map to `DataRecord[]`, call `registerParser(pattern, fn)`. No router changes needed — the import in `electron/ipc/router.ts` line 11 is the only wiring required.

#### 2. Add timeline/chart view using `@observablehq/plot` (unblocks Phase 2)

`@observablehq/plot` is already installed (`package.json` line 18) but zero files import it. Add a `Timeline` component to `src/App.tsx` or a new `src/pages/Timeline.tsx` tab. Minimum viable chart: a dot plot of `records` grouped by `platform` over time — Plot.dot(records, {x: "timestamp", y: "platform", fill: "category"}). Wire it to the existing `trpc.getRecords` call with a higher limit (200). This is a ~60-line addition and will immediately make the app visually useful.

#### 3. Migrate `electron/ingest/linkedin.ts` to the streaming path (fixes streaming-first violation)

`ingestLinkedin` at line 77 calls `fs.readFileSync(zipPath)` then `unzipSync(new Uint8Array(buf))` — reads the entire ZIP into memory. This violates the core streaming-first principle and will OOM on large LinkedIn exports (some users have 100MB+ ZIPs).

Fix: register LinkedIn CSV parsers through the same `registerParser` + `streamIngestFile` pipeline:
- `electron/ingest/parsers/linkedin/connections.ts` — pattern `**/Connections.csv`
- `electron/ingest/parsers/linkedin/messages.ts` — pattern `**/messages.csv`
- etc. (one file per CSV type in the LinkedIn export)

Then change the `ingestLinkedin` tRPC mutation in `electron/ipc/router.ts` (line 66–71) to call `streamIngestFile(input.path)` instead of the legacy `ingestLinkedin()` function. The `ingest/linkedin.ts` file can be deleted once migrated.

---

### Architectural Risks and Blockers

**1. `electron/ai/gemini.ts:generateWithGemini` is non-streaming and blocks on large prompts.**
`model.generateContent(prompt)` (line 40) awaits the full Gemini response before returning. The `fmtData()` call in `lenses.ts` can produce prompts with thousands of tokens (40 sample titles, 35 conversation titles, 24 months of data). On slow connections or large datasets this will make the UI hang with no progress indicator. Fix: use `model.generateContentStream()` and forward chunks over a tRPC subscription or event. This is the single biggest UX risk before showing the app to real users.

**2. `electron/main.ts:seedFakeRecords()` will pollute real user installs.**
Line 40 of `main.ts` calls `seedFakeRecords()` unconditionally at startup. The guard inside `seedFakeRecords` (db/index.ts line 25) only skips if `COUNT(*) > 0`, meaning a user who imports their real data, deletes it via the platform filter, and re-opens the app will *not* get fake records back — but a brand-new install will always start with 6 fake Google/Meta/Spotify/Amazon records. Remove the `seedFakeRecords()` call before any user-facing release.

**3. `src/pages/Reclaim.tsx` uses `window.open` directly (line 64) — may misbehave in Electron.**
The `setWindowOpenHandler` in `main.ts` (line 32) intercepts new-window requests and routes them to `shell.openExternal`, but `window.open` from the renderer with `'_blank'` triggers this handler. This actually works correctly *today* because the handler returns `{ action: 'deny' }` after calling `shell.openExternal`. However, this is brittle — a Chromium update or Electron upgrade could change the timing. The correct fix is to expose `shell.openExternal` via an IPC channel and call it explicitly from Reclaim.tsx.

**4. `electron/db/queries.ts` is dead code — `router.ts` has diverged with inline SQL.**
`getLensResult` and `saveLensResult` in `db/queries.ts` (lines 6–23) are never called. The `generateLens` mutation in `ipc/router.ts` (lines 98–107) contains inline `INSERT INTO lens_results` SQL. The `getCachedLens` query (lines 86–93) also has inline SQL. This creates two maintenance surfaces for the same table. Either delete `queries.ts` or migrate `router.ts` to use it — currently it's both.

**5. Ingestion progress is swallowed — no feedback for multi-file Google Takeout imports.**
`streamIngestFile` accepts an `onProgress` callback (stream-download.ts line 18) but the `ingestGoogle` mutation in `router.ts` (lines 53–64) never passes one. Users see a static "Importing 3 ZIP(s)..." string in `App.tsx` (line 83) regardless of whether 10 or 10,000 files have been processed. For large Takeout archives (Google exports can contain thousands of files), this feels broken. Wire `onProgress` to an IPC event or at minimum return per-ZIP stats.

**6. Only LinkedIn data reaches the AI — the lenses are hard-coded.**
`runLens` in `lenses.ts` (line 205) calls `aggregateLinkedIn()` regardless of which lens is requested. Once Google and Meta data are ingested (Phases 3 and 6), the lenses will still only analyze LinkedIn. The aggregation layer needs a cross-platform strategy before Phase 8 can be considered complete.
