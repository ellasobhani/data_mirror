import { aggregateLinkedIn, LinkedInAggregate } from './aggregate'
import { generateWithGemini } from './gemini'

export type LensId = 'marketer' | 'network' | 'relationships'

export interface Lens {
  id: LensId
  title: string
  subtitle: string
  description: string
  icon: string
}

export const LENSES: Lens[] = [
  {
    id: 'marketer',
    title: "The Marketer's Playbook",
    subtitle: 'What LinkedIn knows about you — and how they sell it',
    description: 'See yourself through an advertiser\'s eyes. This is the targeting file LinkedIn builds on you, and exactly how it\'s used against you.',
    icon: '🎯',
  },
  {
    id: 'network',
    title: 'Network DNA',
    subtitle: 'What your connection graph says about who you are',
    description: 'Your professional identity is encoded in who you\'ve chosen to connect with. Here\'s what that data actually reveals.',
    icon: '🧬',
  },
  {
    id: 'relationships',
    title: 'Relationship Reality',
    subtitle: 'Who actually shows up — and who\'s just a number',
    description: 'You have connections. You have conversations. These are not the same thing. Here\'s the gap.',
    icon: '🔍',
  },
]

function fmtData(data: LinkedInAggregate): string {
  const c = data.connections
  const m = data.messages

  // Pre-compute percentages so the model reasons from facts, not raw counts
  const industryPct = c.total > 0
    ? Object.entries(c.industryBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${v} (${Math.round((v / c.total) * 100)}%)`)
        .join(', ')
    : '(no connections ingested)'

  const seniorityPct = c.total > 0
    ? Object.entries(c.seniorityBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${v} (${Math.round((v / c.total) * 100)}%)`)
        .join(', ')
    : '(no connections ingested)'

  // Year-over-year growth with deltas and cumulative totals
  let cumulative = 0
  const growthWithDeltas = c.byYear.map((x, i) => {
    cumulative += x.count
    const prev = i > 0 ? c.byYear[i - 1].count : null
    const delta = prev !== null ? (x.count > prev ? `+${x.count - prev}` : `${x.count - prev}`) : 'baseline'
    return `${x.year}: +${x.count} (${delta} YoY, ${cumulative} total)`
  }).join(' | ')

  // Peak growth year
  const peakYear = c.byYear.reduce((best, x) => x.count > best.count ? x : best, c.byYear[0] ?? { year: 0, count: 0 })

  // Ghost network ratio — pre-computed so the prompt can cite it as a fact
  // Uses uniqueSenderCount (tracked before slicing) so the ratio isn't capped at 20
  const uniqueSenders = m.uniqueSenderCount
  const ghostPct = c.total > 0
    ? Math.round(((c.total - uniqueSenders) / c.total) * 100)
    : 100

  // Recruiter % of inbound
  const recruiterPct = m.inbound > 0 ? Math.round((m.recruiterCount / m.inbound) * 100) : 0

  // Peak message month
  const peakMonth = m.byMonth.reduce(
    (best, x) => x.count > best.count ? x : best,
    m.byMonth[0] ?? { month: 'unknown', count: 0 }
  )

  const topCo = c.topCompanies.slice(0, 15).map(x => `${x.company} (${x.count})`).join(', ')
  const senders = m.topSenders.slice(0, 15).map(x => `${x.name} (${x.count} msgs)`).join(', ')
  const titles = m.topConversationTitles.slice(0, 35).join(' | ')

  return `
USER: ${data.userName}

CONNECTIONS (${c.total} total):
- Industry breakdown: ${industryPct}
- Seniority breakdown: ${seniorityPct}
- Top companies: ${topCo}
- Growth by year (with YoY delta and running total): ${growthWithDeltas}
- Peak growth year: ${peakYear.year} (+${peakYear.count} new connections)
- Sample job titles in network: ${c.sampleTitles.slice(0, 40).join(', ')}

MESSAGES (${m.total} total messages):
- Inbound: ${m.inbound} | Outbound: ${m.outbound}
- Recruiter/sales outreach: ${m.recruiterCount} messages (${recruiterPct}% of all inbound)
- Unique people who have ever messaged: ${uniqueSenders} out of ${c.total} connections
- Ghost network: ~${ghostPct}% of connections have NEVER sent a message
- Top senders (by message count): ${senders}
- Conversation topics/titles: ${titles}
- Message volume by month (recent 24mo): ${m.byMonth.map(x => `${x.month}: ${x.count}`).join(', ')}
- Peak message month: ${peakMonth.month} (${peakMonth.count} messages)
`.trim()
}

function marketerPrompt(data: LinkedInAggregate): string {
  return `You are a senior LinkedIn advertising consultant. A client has hired you to build a targeting playbook for one specific person. You have their real LinkedIn data — use the actual numbers. Write from the advertiser's chair, not the user's.

${fmtData(data)}

Write the playbook with exactly these sections. Every claim must be traceable to a specific number or pattern in the data above. Do not use placeholders or hedging language.

## 🎯 LinkedIn Campaign Manager Profile
The exact settings an advertiser would enter to reach this person. Use real LinkedIn Campaign Manager field names:
- **Job Function:** [cite the dominant job function inferred from the industry breakdown percentages]
- **Seniority:** [cite the exact seniority level from the seniority breakdown — name the % figure]
- **Industries:** [list the top 3 industries by % from the data]
- **Company Size:** [infer from the types of companies in top companies list]
- **Skills:** [list 8–10 LinkedIn skills this person likely has — infer from the job titles in "Sample job titles in network"]
- **Interests:** [LinkedIn interest categories that match the conversation topics and industries]
- **Member Traits:** [behavioral traits based on message patterns and network growth pace]
- **Estimated Audience Size:** [how many LinkedIn users share this profile — narrow/broad]

## 💰 Your Market Value to Advertisers
- **CPM range:** Provide a specific dollar range (e.g. "$28–$45 CPM") based on the seniority mix and industry. Senior IC / Manager in tech commands higher CPM than junior roles. Show your reasoning.
- **Why you command this price:** Cite specific signals — e.g. "X% of your connections are Manager/Director level, placing you in LinkedIn's 'decision-maker adjacent' segment"
- **Who's actively bidding for you:** List 5 specific advertiser categories spending to reach this profile type, with one-line reasoning for each tied to the data

## 📋 3 Ads Running Against You Right Now
Write each ad exactly as it would appear in the feed. Make them feel real — specific company names, realistic copy:

**Ad 1:** [Sponsored Content]
- Advertiser: [specific company or category]
- Headline: "[realistic ad headline targeted at this person's profile]"
- Body: "[2 lines of copy]"
- Targeting logic: [which exact data points triggered this — cite the numbers]

**Ad 2:** [InMail]
**Ad 3:** [Dynamic Ad]

## 🧠 5 Inferences LinkedIn's Algorithm Has Made
These are not things the user stated — these are conclusions drawn from behavioral signals. For each, name the specific data signal that produced it:
1. [inference] — Signal: [specific number or pattern from the data]
2. [inference] — Signal: [specific number or pattern]
3. [inference] — Signal: [specific number or pattern]
4. [inference] — Signal: [specific number or pattern]
5. [inference] — Signal: [specific number or pattern]

## 🔦 What You Revealed Without Knowing It
3–4 short paragraphs, analytical and direct. Reference actual numbers: the YoY growth pattern, the peak growth year, the recruiter % of inbound, the ghost network ratio. What do these specific patterns reveal about career anxieties, status signals, and behavioral tells that the user never intended to broadcast? Make it feel like a data scientist reading the subtext between the lines.`
}

function networkPrompt(data: LinkedInAggregate): string {
  return `You are a network analyst specializing in professional graphs. Analyze this LinkedIn connection data and tell this person what their network actually says about who they are and where they're headed. Ground every observation in the actual numbers — cite them explicitly.

${fmtData(data)}

Write a clear, honest, insightful analysis with these sections. No fluff — every paragraph should contain at least one specific number from the data above.

## 🧬 Your Professional Identity (As Your Network Sees It)
Based purely on the composition of connections — not what the user claims about themselves. State the dominant industry cluster by percentage. Name the specific seniority composition and what it implies about this person's own level. If they have X% Software/Engineering connections and Y% at Manager+ level, what does that combination say about their peer group and likely status?

## 📈 How Your Network Has Grown
Work through the YoY growth data with deltas. Identify the explosive years vs. the plateaus. Name the peak growth year and speculate specifically on what was probably happening in their career (job change? conference circuit? promotion that put them in a new peer group?). What does the growth pace in the most recent years signal about their current activity?

## 🏢 Your Power Clusters
Name the specific top companies that dominate their network and what concentration in those companies means strategically. Are they a one-world specialist or a multi-industry connector? Which company or industry cluster gives them reach or access that most people in their field don't have?

## 🕳️ The Gaps (What Your Network Is Missing)
Based on the industry and seniority breakdown, what types of connections are conspicuously underrepresented? Be specific: if they're heavy in IC roles but light in C-Suite, what does that gap cost them? Which industries are at <2% that you'd expect to see for someone in their position?

## ⚡ Your Network's Hidden Value
One or two specific, concrete opportunities that likely exist in their current network that they're probably not leveraging. Name specific company types or industries from the top companies list. Make a real recommendation, not a generic one.`
}

function relationshipsPrompt(data: LinkedInAggregate): string {
  return `You are a behavioral analyst reviewing someone's professional communication patterns. Using only LinkedIn messaging metadata (no message content — only who reached out, how often, and conversation titles), tell this person the truth about their professional relationships. The data already contains pre-computed ratios — use them as stated facts, not as things to recalculate.

${fmtData(data)}

Write this analysis with these sections. Cite specific numbers in every section.

## 📊 The Real Numbers
The ghost network figure is pre-computed above — state it as the opening fact of this section, then interpret it. What does it mean that ~X% of their connections have never sent a single message? What does the inbound/outbound ratio say about whether this person is sought out or initiates? What does ${data.messages.recruiterCount} recruiter messages (the pre-computed % of inbound) say about their market visibility and perceived availability?

## 👥 Who Actually Shows Up
From the top senders list: identify what types of people keep coming back (recruiters, vendors, peers, mentors?). Look at the message counts — what does it say about a person that their most active correspondents message them X times vs. once? Name specific patterns from the conversation titles. These ${data.messages.uniqueSenderCount} people represent the real professional network inside the nominal one.

## 📉 The Ghost Network
${data.connections.total} connections. ${data.messages.total} messages across all conversations. The pre-computed ghost network ratio is in the data — lead with it, then tell the truth about what it means. LinkedIn connections are not professional relationships. What is this person actually looking at when they see their connection count?

## 🎯 What Your Inbox Reveals About Your Reputation
Based on conversation topics and who's reaching out: what does the inbound traffic tell us about how the market has categorized this person? What are they known for — or assumed to be available for — based on who is targeting them and what they want? Look at the recruiter pattern and the conversation titles together.

## 🌱 The Relationships Worth Salvaging
In the noise of ${data.messages.total} messages, where do real professional relationships likely exist? What signals in the top senders list and message frequency distinguish genuine professional relationships from transactional ones? Name the patterns specifically.`
}

export async function runLens(id: LensId): Promise<string> {
  const data = aggregateLinkedIn()

  let prompt: string
  if (id === 'marketer') prompt = marketerPrompt(data)
  else if (id === 'network') prompt = networkPrompt(data)
  else prompt = relationshipsPrompt(data)

  return generateWithGemini(prompt)
}
