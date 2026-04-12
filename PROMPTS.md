# Lens Prompt Design

## Philosophy

Lenses are the core product value of Data Mirror. The quality bar is: someone reading a lens result should say "how did it know that?" — not "that's obvious." The difference between those two outcomes is entirely in prompt design and how well the data is aggregated before the model sees it.

**The single biggest mistake in prompt engineering for personal data:** making the model do arithmetic. If the prompt passes `inbound: 180, recruiterCount: 43` and says "do the math," the model will sometimes compute 24%, sometimes say "nearly a quarter," and sometimes just skip the calculation. Pre-compute the ratio in code. Pass `recruiter outreach: 43 messages (24% of all inbound)`. Now the model's job is interpretation, not arithmetic — and interpretations are what users find valuable.

**Specificity is an engineering concern.** Every vague output ("you're well-connected in tech") traces back to a specific engineering failure: either the data wasn't aggregated into a useful signal, or the prompt didn't tell the model to cite the actual numbers. Fix it in code, not in prose.

---

## Data Contract — `fmtData()` in `lenses.ts`

Every field passed to the prompts and why:

| Field | Source | Why it's included |
|---|---|---|
| `userName` | Inferred from message `to` field | Personalizes the analysis; model addresses the user by name |
| `c.total` | Count of `category='social'` records | Denominator for all percentage calculations |
| `industryPct` | Computed from `inferIndustry()` on each connection's position + company | Tells the advertiser lens which LinkedIn industry categories to target; tells the network lens which world this person lives in |
| `seniorityPct` | Computed from `inferSeniority()` on each position | Key for CPM estimation (senior = expensive to reach) and for understanding peer group |
| `topCo` (top 15) | Top companies by connection count | Advertiser lens: which company audiences overlap; network lens: power cluster analysis |
| `growthWithDeltas` | YoY connection counts with delta and cumulative running total | Pre-computed so the model reasons about acceleration/deceleration, not just raw counts |
| `peakYear` | Year with highest new connections | Anchors the "what were you doing then?" narrative |
| `sampleTitles` (40) | Unique job titles from connections | Skill inference for the advertiser lens; career cluster signal for the network lens |
| `m.total` | Count of `category='message'` records | Total message volume denominator |
| `m.inbound / m.outbound` | Direction inferred from `from !== userName` | Sought-out vs. initiator ratio — key status signal |
| `recruiterPct` | `recruiterCount / inbound * 100`, pre-computed | Passed as a finished fact so the model interprets, not calculates |
| `ghostPct` | `(total_connections - unique_senders) / total * 100` | The ghost network ratio — the most striking number in the relationships lens |
| `uniqueSenders` | Distinct names in `topSenders` | Real network size vs. nominal connection count |
| `topSenders` (15) | Top by message count | Who actually shows up; pattern recognition for relationships lens |
| `titles` (35) | Conversation titles (topic extraction) | What topics dominate the inbox; what the market is targeting this person for |
| `byMonth` (24mo) | Monthly message volume | Seasonality; activity peaks and troughs |
| `peakMonth` | Month with highest message count | Anchor for timeline narrative |

**What `inferIndustry()` and `inferSeniority()` do and don't capture:**
- They use keyword matching on job titles and company names — fast and good enough for aggregation
- They will miscategorize hybrid roles ("product engineer" may land in Software or Product depending on word order)
- "Other" is a catch-all that grows with unusual titles — if it's >15% it means the network has significant diversity that the categorization isn't capturing

---

## Lens Designs

### The Marketer's Playbook (`marketer`)

**Intent:** Make the user see themselves through an advertiser's eyes. The shock of specificity — "LinkedIn has me in the $35–$50 CPM range because 34% of my connections are Manager+" — is more effective than a generic "companies pay to reach people like you."

**Key signals used:**
- `seniorityPct` → CPM range estimate
- `industryPct` → Campaign Manager industry targeting fields
- `sampleTitles` → Skill inference for the skills targeting field
- `growthWithDeltas` + `peakYear` → Behavioral signals for the "what you revealed" section
- `recruiterPct` → Market visibility / passive candidate signal

**Design decisions:**
- The prompt explicitly says "provide a specific dollar range" and "show your reasoning" — without this instruction, models produce hedged ranges or say "depends on factors"
- The "5 inferences" section requires citing the specific data signal for each inference — this forces the model to connect claims to evidence rather than generating plausible-sounding but untethered observations
- The 3 ad examples are constrained to specific formats (Sponsored Content, InMail, Dynamic) — this prevents the model from producing generic ad copy and forces it into LinkedIn-specific formats

**Known weaknesses:**
- CPM ranges will be estimates — Gemini doesn't have current LinkedIn CPM data. The range will be directionally correct but may be stale. Consider adding a disclaimer in the UI.
- Skill inference from job titles in the network is second-order and noisy. The model will get the top skills right but may miss niche technical skills.

---

### Network DNA (`network`)

**Intent:** Tell the user what their connection graph reveals about who they are professionally — not who they think they are. The power of this lens is in identifying the implicit peer group and the gaps.

**Key signals used:**
- `industryPct` → Identity: which world does this person actually live in?
- `seniorityPct` → Peer group: who are they surrounded by?
- `growthWithDeltas` → Career phase mapping
- `peakYear` → Inflection point narrative
- `topCo` → Power cluster identification
- `sampleTitles` → Fine-grained industry and role cluster signal

**Design decisions:**
- The prompt requires at least one specific number in every paragraph — this prevents the vague-but-confident-sounding output that models produce when given latitude
- "Name the peak growth year and speculate on what was happening" gives the model permission to be specific and hypothesis-driven, which is more useful than hedged generalities
- The gaps section asks for industries at "<2%" — this grounds the gap analysis in actual underrepresentation rather than generic advice

**Known weaknesses:**
- Career phase mapping is speculative. The model will produce plausible narratives ("2021 growth suggests a job change") that may be wrong. The UI should frame these as hypotheses.
- The "hidden value" section is the hardest to make specific — the model tends to produce generic networking advice. Consider adding more signal (e.g. which companies have >3 connections — those are warm intros, not cold contacts).

---

### Relationship Reality (`relationships`)

**Intent:** Force the user to confront the gap between their connection count and their actual professional relationships. The ghost network ratio is the central fact; everything else interprets it.

**Key signals used:**
- `ghostPct` → The opening fact of the analysis
- `m.inbound / m.outbound` → Status signal: sought-out vs. initiator
- `recruiterPct` → Market perception: what does the inbound mix say about how others see this person?
- `topSenders` + message counts → Who the real network actually is
- `titles` → What topics dominate; what the market is targeting this person for

**Design decisions:**
- The ghost network ratio is pre-computed in `fmtData()` and stated as a fact in the data block. The prompt tells the model to "lead with it" — this prevents the model from burying the most striking number in a qualification.
- The prompt tells the model explicitly NOT to recalculate — "the pre-computed ratio is in the data, use it as stated." This prevents rounding errors and inconsistent phrasing.
- The final section ("relationships worth salvaging") is intentionally framed as detection, not advice — "where do real relationships exist in this data?" rather than "here's who you should reconnect with"

**Known weaknesses:**
- The ghost network calculation uses `topSenders.length` (capped at 20) as the "people who have ever messaged" figure. The real number of unique senders could be higher. This slightly overstates the ghost network ratio. Consider querying `COUNT(DISTINCT)` on the sender field in a future iteration.
- The relationships lens works best with 500+ messages. Below that, the patterns are too thin for confident inference.

---

## Iteration Log

| Date | Lens | Change | Outcome |
|------|------|--------|---------|
| 2026-03-19 | all | Pre-compute percentages, YoY deltas, ghost ratio, recruiter %, peak month in fmtData() | Baseline — to be rated against v0 prompts |
| 2026-03-19 | all | Rewrote all three prompts to require specific number citations per section | Baseline — to be rated against v0 prompts |
