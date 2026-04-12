# DataMirror — Daily Progress Log

---

## 2026-04-12

### Phase Status

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 0 | Electron skeleton | ✅ Complete | Electron 31 + tRPC + SQLite WAL + 3-tab shell |
| 1 | Streaming ingestion core | 🔄 In Progress | Pipeline built; LinkedIn not yet streaming |
| 2 | Basic dashboard | 🔄 In Progress | Record list exists; no charts, search, or pagination UI |
| 3 | More parsers (Google sub-parsers, Meta) | ⬜ Not Started | Only 1 of ~8 needed Google parsers exists |
| 4 | Credential storage + Playwright agent | ⬜ Not Started | `keytar` installed, unused |
| 5 | Email monitor + IMAP auto-download | ⬜ Not Started | `imapflow` installed, unused |
| 6 | Remaining platforms (Meta, Apple, X, Amazon, Spotify, TikTok) | ⬜ Not Started | Types defined in `shared/schema.ts`, no parsers |
| 7 | Identity Mirror view | ⬜ Not Started | No component or data model |
| 8 | AI summarization + chat | 🔄 In Progress | 3 lens prompts live; no FTS5, no streaming, no rating UI |
| 9 | Polish + resilience | ⬜ Not Started | — |

---

### Recent Completed Work (from `git log --oneline -20`)

```
8f5e998 initial commit
```

Single commit. This is a fresh scaffold — all existing work landed in one batch:
- Electron + electron-vite skeleton with tRPC IPC transport
- SQLite schema: `records`, `platform_status`, `ai_summaries`, `lens_results`, `reclaim_actions`
- LinkedIn ingestor parsing 5 CSV files: `connections.csv`, `messages.csv`, `reactions.csv`, `comments.csv`, `shares.csv`
- Streaming ZIP pipeline (`stream-download.ts`) using fflate's incremental `Unzip` class
- Parser registry (`ingest/router.ts`) with glob-matching `registerParser`
- Google Search History parser (`parsers/google/search-history.ts`) — only registered parser
- LinkedIn data aggregator (`ai/aggregate.ts`): industry/seniority inference, ghost ratio, recruiter %, YoY deltas
- Three AI lenses fully written (`ai/lenses.ts`): marketer, network, relationships — all with pre-computed ratios
- Gemini integration (`ai/gemini.ts`) using `gemini-2.0-flash-lite`; key persisted to `userData/config.json`
- Polished Insights UI (`src/Insights.tsx`): IBM Plex Mono aesthetic, amber scan-line animation, collapse/expand, cache display
- Reclaim tab (`src/pages/Reclaim.tsx` + `electron/reclaim/deletion-requests.ts`): 5 platforms with direct opt-out/deletion links
- `db/queries.ts`: `getLensResult`, `saveLensResult`, `rateLens`, `upsertReclaimAction`, `updateReclaimStatus`
- PROMPTS.md: detailed lens design rationale, data contract table, iteration log

---

### Top 3 Tasks for Today's Session

#### 1. Port LinkedIn ingest to the streaming pipeline (Phase 1 critical gap)

`electron/ingest/linkedin.ts:76-78` calls `fs.readFileSync(zipPath)` + `unzipSync(new Uint8Array(buf))`. This loads the entire ZIP synchronously into RAM. A full LinkedIn export can exceed 100 MB. The streaming pipeline already exists in `stream-download.ts` and handles memory efficiently (~10 MB peak per entry).

**Fix:** Register each LinkedIn CSV as a named parser via `registerParser`, then route LinkedIn ZIPs through `streamIngestFile` instead of `ingestLinkedin`. Suggested patterns:
```
registerParser('**/connections.csv', parseLinkedInConnections)
registerParser('**/messages.csv',    parseLinkedInMessages)
registerParser('**/reactions.csv',   parseLinkedInReactions)
registerParser('**/comments.csv',    parseLinkedInComments)
registerParser('**/shares.csv',      parseLinkedInShares)
```
Update `router.ts:66-71` to call `streamIngestFile(input.path)` instead of `ingestLinkedin(input.path)`, and update the import in `ipc/router.ts:11` to include all new LinkedIn parsers.

**Note:** The `DELETE FROM records WHERE platform = ?` pre-wipe at `linkedin.ts:154` needs to happen before streaming begins — either add a `beforeIngest` hook to the router, or execute the delete explicitly before calling `streamIngestFile`.

#### 2. Add Google Takeout sub-parsers: YouTube, Location, Chrome (unblocks Phase 3)

`ipc/router.ts:11` imports only `'../ingest/parsers/google/search-history'`. The `ingestGoogle` tRPC mutation already calls `streamIngestFile`, so new parsers are automatically activated by adding import lines. Each parser is ~40 lines, following the identical pattern to `search-history.ts`.

Priority order by data richness:
1. **YouTube history** — `**/My Activity/YouTube/MyActivity.json` → `category: 'media'`
2. **Chrome browsing** — `**/My Activity/Chrome/MyActivity.json` → `category: 'browse'`
3. **Location History** — `**/Location History/Records.json` → `category: 'location'` (note: this file uses a different schema: `{ locations: [{ latitudeE7, longitudeE7, timestamp }] }`)

For each: create `electron/ingest/parsers/google/{youtube,chrome,location}.ts`, call `registerParser(glob, parseFn)`, add the import to `ipc/router.ts`.

#### 3. Wire up lens quality rating (Phase 8 polish, 30-minute task)

`db/queries.ts:25-31` has `rateLens(lensId, quality)` fully implemented. `db/schema.ts:46` has the `lens_quality INTEGER` column. But there is no tRPC endpoint and no UI.

**Backend:** Add to `ipc/router.ts`:
```ts
rateLens: t.procedure
  .input(z.object({ lensId: lensIdSchema, quality: z.number().int().min(1).max(5) }))
  .mutation(({ input }) => { rateLens(input.lensId, input.quality); return { ok: true } }),
```

**Frontend:** In `src/Insights.tsx`, below the `GENERATED` timestamp line in the result footer (~line 277), add a 1–5 star widget that calls `trpc.rateLens.mutate`. This closes the feedback loop documented in `PROMPTS.md`'s iteration log.

---

### Architectural Risks & Blockers

**Risk 1 — `upsertReclaimAction` silently no-ops (data loss bug)**
`electron/db/queries.ts:53` uses `ON CONFLICT DO NOTHING` but `reclaim_actions` in `schema.ts` has no `UNIQUE` constraint on `(platform, action_type)`. The conflict clause never fires; every call inserts a new row. If the Reclaim tab ever writes actions (e.g. tracking that a user opened a deletion link), it will accumulate duplicates. Fix: add `UNIQUE(platform, action_type)` to the `reclaim_actions` DDL, or remove the upsert logic and use a plain insert-if-not-exists pattern.

**Risk 2 — Duplicate lens-save logic**
`ipc/router.ts:101-106` reimplements the lens-save inline:
```ts
db.prepare(`INSERT INTO lens_results ... ON CONFLICT ...`).run(...)
```
`db/queries.ts:16-23` has `saveLensResult()` for exactly this purpose. If the INSERT template ever changes (e.g. to write `lens_quality` default), only one path gets updated. Replace the inline SQL in `router.ts:generateLens` with a call to `saveLensResult(input.lensId, result)`.

**Risk 3 — `seedFakeRecords()` runs on every app start**
`electron/main.ts:40` calls `seedFakeRecords()` unconditionally. The guard (`count > 0`) is safe for now, but once real data is ingested it still runs a `COUNT(*)` query on every cold start. Move this call behind a `process.env.NODE_ENV === 'development'` gate before Phase 3 ships, otherwise new users see fake records mixed with real ones until they import.

**Risk 4 — `@anthropic-ai/sdk` installed but unused**
`package.json` lists `@anthropic-ai/sdk@^0.36.3` as a dependency, but all AI code uses `@google/generative-ai` (Gemini). The 9-phase plan lists Claude API for Phase 8. Either: (a) the plan changed to Gemini-only, in which case remove the Anthropic SDK to avoid confusion; or (b) Claude was planned for the chat interface and Gemini for lenses — clarify and document in `PROMPTS.md`.

**Risk 5 — Ghost network ratio uses `topSenders.length` cap**
Documented in `PROMPTS.md` but the actual fix is simpler than stated. `aggregate.ts:169-170` computes `topSenders` by slicing to 20, but `uniqueSenderCount` is correctly tracked as `Object.keys(senderCt).length` (the full count, not the slice). The ghost ratio formula in `lenses.ts:71` uses `m.uniqueSenderCount` (the full count), so the ratio is **already correct**. The PROMPTS.md note is stale — no fix needed here.

**Blocker — `plan.md` missing**
The build plan is referenced in PROMPTS.md and this review, but no `plan.md` file exists in the repo. The phase descriptions live only in external context. Create `plan.md` to canonicalize the phase definitions so future review agents have a stable reference.
