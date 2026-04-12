# DataMirror — Build Plan

**Stack:** Electron 31 · React 18 · TypeScript · better-sqlite3 · tRPC (electron-trpc) · fflate · Gemini API

**Core principles:**
- Privacy-first: message bodies never leave the device; only aggregated metadata goes to AI
- Streaming-first: ZIPs are never written to disk — `fs.createReadStream` → fflate `Unzip` → parser → SQLite

---

## Phase 0 — Electron Skeleton ✅
**Goal:** Runnable app with IPC, DB, and a minimal UI.

- [x] Electron 31 + electron-vite build system
- [x] tRPC over IPC via `electron-trpc` (type-safe main↔renderer communication)
- [x] `better-sqlite3` with WAL mode, initialized at startup
- [x] SQLite schema: `records`, `platform_status`, `ai_summaries`, `lens_results`, `reclaim_actions`
- [x] 3-tab shell: Records · Insights · Reclaim
- [x] Fake seed data for development (gated behind `NODE_ENV=development`)

---

## Phase 1 — Streaming Ingestion Core 🔄
**Goal:** Import any supported ZIP without loading it into RAM. All parsers use the same pipeline.

- [x] Streaming ZIP pipeline: `stream-download.ts` using fflate incremental `Unzip`
- [x] Parser registry: `ingest/router.ts` with glob-matching `registerParser(pattern, fn)`
- [x] Google Takeout ingest tRPC mutation (`ingestGoogle`) calling `streamIngestFile`
- [x] LinkedIn ingest via streaming pipeline (connections, messages, reactions, comments, shares)
- [ ] Progress reporting: surface `onProgress` callbacks to the renderer via IPC during long imports
- [ ] Deduplication: skip re-inserting records that already exist (by platform + timestamp + title hash)

---

## Phase 2 — Basic Dashboard 🔄
**Goal:** Meaningful at-a-glance view of what's been imported.

- [x] Record list with platform/category badges, timestamp, URL
- [x] Platform filter (all / linkedin / google / meta / spotify / amazon)
- [x] Import buttons for LinkedIn and Google Takeout
- [ ] Timeline chart: records per month using `@observablehq/plot` (already installed)
- [ ] Category breakdown bar chart
- [ ] Full-text search bar (requires FTS5 virtual table — see Phase 8)
- [ ] Pagination UI (backend supports offset/limit, no UI controls yet)
- [ ] Per-platform record counts in filter buttons

---

## Phase 3 — More Parsers ⬜
**Goal:** Google Takeout fully covered; Meta import working.

### Google Takeout sub-parsers
- [x] Search history (`My Activity/Search/MyActivity.json`) → `category: search`
- [x] YouTube history (`My Activity/YouTube/MyActivity.json`) → `category: media`
- [x] Chrome browsing (`My Activity/Chrome/MyActivity.json`) → `category: browse`
- [x] Location History (`Location History/Records.json`) → `category: location`
- [ ] Maps (`My Activity/Maps/MyActivity.json`) → `category: location`
- [ ] Google Drive (`My Activity/Drive/MyActivity.json`) → `category: browse`
- [ ] Gmail metadata (`Mail/`) → `category: message` (subject + sender only, no body)

### Meta
- [ ] Facebook posts (`your_facebook_activity/posts/`) → `category: social`
- [ ] Messenger metadata (`messages/inbox/`) → `category: message`
- [ ] Ad interests (`ads_information/`) → `category: ad_profile`
- [ ] Off-Facebook activity → `category: ad_profile`

---

## Phase 4 — Credential Storage + Playwright Automation Agent ⬜
**Goal:** App can request a platform export on the user's behalf.

- [ ] Credential storage via `keytar` (already installed) — OS keychain, never SQLite
- [ ] Playwright automation agent: headless browser that logs in, navigates to export page, requests download
- [ ] Platform automation scripts: LinkedIn, Google, Meta
- [ ] `platform_status` table wired to automation state machine (`requesting` → `waiting` → `downloading` → `done`)
- [ ] Status UI in Records tab showing per-platform progress

---

## Phase 5 — Email Monitor + Auto-Download ⬜
**Goal:** App watches for platform "your data is ready" emails and auto-downloads the ZIP.

- [ ] IMAP connection via `imapflow` (already installed) — Gmail or any IMAP provider
- [ ] Email filter rules: detect "Your LinkedIn data is ready", "Google Takeout ready", etc.
- [ ] On match: extract download link, pipe response stream directly through `streamIngestFile`
- [ ] Background polling (configurable interval, respects IMAP IDLE when available)
- [ ] Notification: system tray alert when new data is imported

---

## Phase 6 — All Remaining Platforms ⬜
**Goal:** Every platform in `shared/schema.ts` has at least one working parser.

Platforms to add: `meta` (partially Phase 3), `apple`, `x`, `amazon`, `spotify`, `tiktok`, `reddit`, `microsoft`, `uber`

For each platform:
- [ ] ZIP structure documented
- [ ] At least one parser registered (most valuable data category first)
- [ ] Import button or automation script

Priority order: Spotify (listening history, straightforward JSON) → Amazon (purchase history) → X (tweets + DMs metadata) → Apple (Health, Screen Time) → TikTok → Reddit → Microsoft → Uber

---

## Phase 7 — Identity Mirror View ⬜
**Goal:** A single view that shows what each platform has inferred about the user.

- [ ] New tab: "Identity" (or integrate into Insights)
- [ ] Per-platform inference cards: ad categories, interest labels, inferred demographics
- [ ] Sources: pull from `category: ad_profile` records (Meta ad interests, Google ad profile, etc.)
- [ ] Cross-platform aggregation: which inferences appear on 3+ platforms?
- [ ] "How they see you" summary lens (Gemini-powered, metadata only)

---

## Phase 8 — AI Summarization + Chat 🔄
**Goal:** Gemini lenses fully operational; FTS5 search; chat interface.

- [x] Gemini integration (`gemini-2.0-flash-lite`); key stored in `userData/config.json`
- [x] LinkedIn data aggregator with pre-computed ratios (ghost network, recruiter %, YoY deltas)
- [x] Three lenses: Marketer's Playbook · Network DNA · Relationship Reality
- [x] Lens result caching in `lens_results` table
- [x] Lens quality rating: `rateLens()` in `db/queries.ts`, tRPC endpoint, star UI in Insights
- [ ] FTS5 virtual table on `records(title, body)` — enables full-text search across all imported data
- [ ] Streaming generation: surface Gemini token stream to renderer via IPC (no waiting for full response)
- [ ] Multi-platform aggregator: extend `aggregate.ts` beyond LinkedIn to Google search patterns, Spotify listening, etc.
- [ ] Chat interface: free-form questions answered from local data via Gemini + FTS5 retrieval
- [ ] `ai_summaries` table wired up: periodic background summarization of new records

---

## Phase 9 — Polish + Resilience ⬜
**Goal:** Shippable to a non-technical user.

- [ ] Error boundaries in React — no white screens
- [ ] Import error recovery: partial failures don't corrupt the DB (wrap each entry in a savepoint)
- [ ] Auto-updater (electron-updater)
- [ ] Onboarding flow: first-run wizard explaining what data to export and how
- [ ] Settings screen: DB location, Gemini key, IMAP config, clear data
- [ ] Export: let users export their unified SQLite DB
- [ ] Code signing + notarization (macOS)
- [ ] Windows build (NSIS installer)
- [ ] Performance: lazy-load Insights tab; virtualize long record lists

---

## Data Model Reference

```
records          — all imported data, one row per event
platform_status  — per-platform import state machine
ai_summaries     — periodic AI-generated summaries (Phase 8)
lens_results     — cached Gemini lens outputs with quality rating
reclaim_actions  — user's data deletion/opt-out action log
```

## Privacy Guarantees (non-negotiable)
1. `body` column in `records` is never included in any AI prompt
2. No data is sent to any server except the Gemini API (metadata only)
3. Credentials stored in OS keychain via `keytar`, never in SQLite
4. ZIP files are never written to disk — streaming pipeline only
