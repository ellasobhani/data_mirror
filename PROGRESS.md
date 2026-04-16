# DataMirror — Daily Progress Log

---

## 2026-04-16

### Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Electron skeleton | ✅ Complete | BrowserWindow, tRPC IPC, SQLite, preload all wired |
| 1 — Streaming ingestion core | 🔄 In Progress | Pipeline built; LinkedIn parser violates streaming contract |
| 2 — Basic dashboard (timeline, charts, search) | ⬜ Not Started | Flat list only; Observable Plot installed but never imported |
| 3 — More parsers (Takeout sub-parsers, Meta) | 🔄 In Progress | 1 of ~15 Takeout parsers built; no Meta parser |
| 4 — Credential storage + Playwright agent | ⬜ Not Started | `keytar` installed, zero usage |
| 5 — Email monitor + auto-download (imapflow) | ⬜ Not Started | `imapflow` installed, zero usage |
| 6 — All remaining platforms | ⬜ Not Started | Schema covers 11 platforms; only LinkedIn + Google search parse |
| 7 — Identity Mirror view | ⬜ Not Started | No aggregation or UI |
| 8 — AI chat + FTS5 streaming | ⬜ Not Started | `@anthropic-ai/sdk` installed, not used; no FTS5 table |
| 9 — Polish + resilience | ⬜ Not Started | — |

---

### Recent Completed Work (git log)

- `8f5e998` **initial commit** — Full project skeleton: Electron 31 + React 18 + TypeScript, tRPC IPC bridge, SQLite schema with WAL mode and migrations, LinkedIn CSV ingest, streaming ZIP pipeline (fflate), Google search-history parser, Gemini AI lenses (marketer/network/relationships), Reclaim tab with deletion links for 5 platforms.

---

### Architectural Observations

#### Critical: LinkedIn ingest violates streaming-first contract
`electron/ingest/linkedin.ts:77` calls `fs.readFileSync(zipPath)` and `unzipSync(new Uint8Array(buf))`. This loads the entire ZIP into memory synchronously — the exact pattern the architecture is designed to avoid. A user with a large LinkedIn export (multi-hundred MB) will hit a process memory spike here. The `streamIngestFile` pipeline in `stream-download.ts` is the correct pattern; LinkedIn needs to be migrated to use `registerParser()` for each of its CSV entry types.

#### Dead code: `queries.ts` not used by the router
`electron/db/queries.ts` exports `getLensResult`, `saveLensResult`, and `rateLens`, but `electron/ipc/router.ts:88-106` duplicates the lens storage logic inline. The `upsertReclaimAction` / `updateReclaimStatus` / `getReclaimActions` functions in `queries.ts` exist but no IPC endpoint exposes them — the Reclaim tab has no persistence layer wired up at all.

#### No streaming progress events to renderer
`streamIngestFile` accepts `onProgress?: ProgressCallback` but `ingestGoogle` in `ipc/router.ts:53-64` never passes a callback. Large Takeout ZIPs show a static "Importing X ZIP(s)..." message with no per-file progress. The tRPC setup uses `electron-trpc` which is request/response only — pushing progress events will require either tRPC subscriptions or a separate `ipcMain.on` channel.

#### `platform_status` table is never written to
The schema defines `platform_status` (`electron/db/schema.ts:22-29`), `getAllPlatformStatuses` is exposed as an IPC query (`ipc/router.ts:34`), but no ingestion path ever calls an INSERT or UPDATE on this table. The table will always return an empty array.

#### `seedFakeRecords()` still called on every startup
`electron/main.ts:41` calls `seedFakeRecords()` unconditionally on `app.whenReady`. It guards on `count > 0`, so it won't re-insert, but it runs a DB query on every cold start. This is fine for dev but must be removed before any production build.

#### `stream-download.ts` name vs. implementation mismatch
The file is named `stream-download.ts`, implying network download support, but it only handles local file paths. `got@14` is installed (`package.json:17`) but not imported anywhere. The original intent was clearly URL-based downloading for Phase 4/5 automation — the function signature will need a `filePath | URL` overload.

#### `ghostPct` calculation is correct (PROMPTS.md note is stale)
`electron/ai/aggregate.ts:168` computes `uniqueSenderCount: Object.keys(senderCt).length` — this counts all unique senders before any slice, so the ghost network ratio is not capped at 20. The "Known weaknesses" note in `PROMPTS.md` is outdated.

---

### Top 3 Tasks for Today's Session

#### 1. Migrate `linkedin.ts` to the streaming pipeline (MOST CRITICAL)
**Why:** Fixes the memory violation and validates the full streaming architecture end-to-end with real multi-file data before more parsers are built on top of it.  
**What to do:**
- Delete `electron/ingest/linkedin.ts`'s `unzipSync` path.
- Create `electron/ingest/parsers/linkedin/connections.ts`, `messages.ts`, `reactions.ts`, `comments.ts`, `shares.ts` — each calls `registerParser('connections.csv', ...)` etc. with glob patterns that match LinkedIn's ZIP structure (`**/connections.csv`).
- Move `parseCSV`, `parseDate`, `col`, `stripHtml` into a shared `electron/ingest/parsers/linkedin/utils.ts`.
- Keep `ingestLinkedin` in `ipc/router.ts` pointing to `streamIngestFile` (the same function already used for Google). The `showOpenDialog` flow already works.
- Wire all five parsers in `ipc/router.ts` via imports (same pattern as `import '../ingest/parsers/google/search-history'`).

#### 2. Add 3–4 high-value Google Takeout parsers
**Why:** Google Takeout is the richest data source and the parser architecture is already validated. Each new parser adds a new `category` of real data visible in the Records tab.  
**Priority order:**
- `**/My Activity/Chrome/MyActivity.json` → `category: 'browse'`
- `**/My Activity/Maps/MyActivity.json` → `category: 'location'`
- `**/My Activity/YouTube/MyActivity.json` → `category: 'media'`
- `**/Location History/Records.json` (Semantic Location History) → `category: 'location'`
- Register all in `ipc/router.ts` imports (one import per parser file).

#### 3. Build the Phase 2 timeline chart using Observable Plot
**Why:** The Records tab is a flat sorted list with no temporal structure — users can't see patterns over time, which is the core value proposition. Observable Plot is installed and ready.  
**What to do:**
- In `src/App.tsx`, add a `getRecords` query variant that returns daily/weekly counts grouped by platform (or add a new `getRecordsByDay` tRPC query in `ipc/router.ts` using a SQLite `strftime('%Y-%W', timestamp/1000, 'unixepoch')` GROUP BY).
- Import `@observablehq/plot` in `src/App.tsx` or a new `src/components/Timeline.tsx`.
- Render a stacked area or dot-plot showing records over time per platform. Platform colors are already defined via `platform-badge` CSS classes in `src/index.css`.
- Add a `useRef` + `useEffect` pattern to mount the Plot SVG into a DOM node.

---

### Blockers / Risks

- **No automated tests.** `package.json` has no `test` script. The streaming pipeline, CSV parser, and AI aggregate functions have zero test coverage. A regression in `parseCSV` (e.g. handling of quoted newlines) would be silent. Recommend adding a minimal Vitest suite for `linkedin.ts` CSV parsing before extending the parser count.
- **`keytar` native binding.** `keytar@7` requires a native rebuild for Electron. `@electron/rebuild` is a devDependency — this is correct — but Phase 4 credential storage will fail silently if the rebuild isn't run after `npm install` in the packaged app. Worth adding a `postinstall` script.
- **Gemini lenses are LinkedIn-only.** `electron/ai/aggregate.ts` only queries `platform='linkedin'`. When Google data is ingested, the Insights tab will not reflect it. The aggregate layer needs a multi-platform redesign before Phase 7.
