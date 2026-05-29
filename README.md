# Sonia · Comment Assist

An internal web app prototype for the Sonia Health growth team. It surfaces public posts, drafts thoughtful AI-written replies, and queues them for a human reviewer to approve, edit, reject, or flag unsafe. **Nothing posts automatically** — the tool stops at human review.

Built for the Consumer Growth Engineering take-home.

---

## Quick start (TL;DR)

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env.local   # ← OPTIONAL, skip this line to use the mock LLM
npm run setup      # seeds 25 mock posts + runs full AI pipeline (~60–120s with key, instant without)
npm run dev
```

Open <http://localhost:3000>. The review queue should have 15+ drafted replies waiting.

**That second line is optional.** If you don't want to use an Anthropic key, just skip it — the app still runs end-to-end on a built-in mock LLM (more on that a few sections down).

### If `npm install` fails with `NODE_MODULE_VERSION` mismatch

That's `better-sqlite3` (a native module) compiled against a different Node version. One-line fix:

```bash
npm rebuild better-sqlite3
```

Then continue with `npm run setup`.

### Without a key

Skip the `.env.local` line. The pipeline uses a deterministic mock LLM (keyword heuristics). Full UI, safety filter, and review flow all work; draft text is templated and prefixed `[mock-llm]` so the mode is obvious.

### Live Reddit ingestion

```bash
npm run ingest:reddit -- r/getdisciplined 10
npm run process
```

Pulls 10 recent public Reddit posts through the same pipeline.

---

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Recommended | (none) | Get one at <https://console.anthropic.com>. Without it, the app uses a mock LLM. |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` | Override the model if needed. |

`.env.local` is gitignored. `.env.example` is the template that ships with the repo.

---

## What it does, in one diagram

```
Sources                 Pipeline (per post)              Reviewer
─────────────────       ─────────────────────────       ─────────────
Mock posts (25)  ──┐                                   ┌──▶ Approve
                   ├──▶  1. Classify (Claude)          │
Reddit JSON  ──────┘     2. Safety check on POST   ────┼──▶ Edit
(public, no auth)        3. Draft (Claude)             │
                         4. Safety check on DRAFT  ────┼──▶ Reject
                                                       │
                                                       └──▶ Mark unsafe
                                                              │
                                                              ▼
                                              SQLite (append-only audit trail)
```

Every post is classified for relevance (0–100), then safety-checked, then drafted, then safety-checked again. A human makes the final call in the web UI. Decisions are append-only.

---

## Architecture

- **Next.js 16 (App Router) + TypeScript.** Single repo, server-rendered pages, API routes.
- **SQLite via `better-sqlite3`.** One file at `data/app.db`. Tables: `posts`, `drafts`, `decisions`.
- **Anthropic SDK + Claude Sonnet 4.6** for classification and drafting, with **prompt caching** on the system prompt so per-post cost stays low.
- **Zod** validates every LLM output (one retry on bad JSON).
- **Rule-based safety filter** for fast deterministic checks; **LLM safety flags** as a second layer.
- **Tailwind CSS v4** for the UI.

### Pipeline detail

For each post:

1. **Classify** (`src/lib/ai/classify.ts`) — Claude scores relevance 0–100, names topics, flags any pre-draft safety risks. Below 35 → skipped (saves tokens + reviewer attention).
2. **Safety filter on the post body** (`src/lib/ai/safety.ts`) — rule-based regex/keyword checks for all 7 categories the rubric names: `crisis`, `minor`, `medical_claim`, `diagnosis_cure_prevention`, `inappropriate_intervention`, `privacy`, `spam_manipulative`. Any hit blocks drafting.
3. **Draft** (`src/lib/ai/draft.ts`) — Claude writes a 1–2 sentence reply. The prompt enforces:
   - specific to the post (no generic affirmation),
   - warm without being saccharine,
   - no em-dashes, no banned openers (`"really resonated"`, `"this hit different"`, etc.),
   - any Sonia mention must start with the literal disclosure `"I work on Sonia,"`.
4. **Variety constraint** (`src/lib/ai/variety.ts`) — classifies each draft's shape (question / quote-reframe / fragment / observation / personal) and tells Claude which shapes to avoid for the next one. Keeps the corpus from feeling repetitive.
5. **Safety filter on the generated draft** — catches links, multiple emojis, cure language, Sonia mentions without disclosure. Retry once; soft-sanitize as final fallback.
6. **Persist** to the `drafts` table.

### Review UI

- Review queue at `/`, sorted unreviewed-first by relevance.
- Filter tabs: Awaiting · Approved · Rejected · Unsafe · Blocked · Skipped · All.
- Each card shows: source badge, author link, post body, relevance tier ("Core fit · 92"), safety flags, decision badge, an editable textarea, an optional reviewer note, and three buttons.
- Editing the textarea then clicking Approve logs the action as `edit` instead of `approve` — preserves the audit distinction.

---

## Project structure

```
sonia-comment-assist/
├── README.md                       # this file
├── APPROACH.md                     # hand-written approach doc
├── AI_LOG.md                       # how AI was used in the build
├── .env.example                    # template — copy to .env.local
├── data/
│   ├── seed-posts.json             # 25 mock posts (all safety categories covered)
│   └── app.db                      # local SQLite (gitignored)
├── src/
│   ├── app/
│   │   ├── page.tsx                # review queue
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── process/route.ts    # POST: run pipeline
│   │       └── decisions/route.ts  # POST: persist a reviewer decision
│   ├── components/
│   │   ├── Logo.tsx
│   │   ├── PostCard.tsx
│   │   ├── DraftReview.tsx         # textarea + buttons (client component)
│   │   ├── FilterTabs.tsx
│   │   ├── ProcessButton.tsx
│   │   ├── RelevanceScore.tsx
│   │   ├── SafetyBadge.tsx
│   │   └── DecisionBadge.tsx
│   └── lib/
│       ├── db.ts                   # SQLite singleton + migrations
│       ├── types.ts                # Zod schemas + TS types
│       ├── seed.ts                 # idempotent seed loader
│       ├── queries.ts              # listReviewItems, insertDecision
│       ├── pipeline.ts             # processPost, processAll
│       ├── ingest/
│       │   └── reddit.ts           # public .json ingestor
│       └── ai/
│           ├── client.ts           # Anthropic client + mock fallback
│           ├── prompts.ts          # Sonia context + comment style guide
│           ├── classify.ts         # relevance + pre-flags
│           ├── draft.ts            # generation + style retries
│           ├── safety.ts           # rule-based filter (post and draft)
│           └── variety.ts          # shape classifier + variety hints
└── scripts/
    ├── db-check.ts                 # diagnostic: list DB tables
    ├── seed.ts                     # load mock posts
    ├── ingest-reddit.ts            # CLI: pull from a subreddit
    ├── process-all.ts              # CLI: run pipeline batch
    ├── drafts-show.ts              # CLI: print all drafts
    ├── ai-classify-sample.ts       # smoke test for classifier
    ├── ai-safety-test.ts           # assertions for safety filter (14/14)
    └── ai-draft-sample.ts          # smoke test for drafter
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the web app at <http://localhost:3000> |
| `npm run seed` | Load the 25 mock posts into SQLite (idempotent) |
| `npm run ingest:reddit -- r/<sub> [limit] [sort]` | Pull live posts from a public subreddit |
| `npm run process` | Run the full AI pipeline over posts without a draft |
| `npm run process -- --reprocess` | Re-draft every post (overwrites existing) |
| `npm run drafts:show` | Print every draft, sorted by relevance score |
| `npm run db:check` | List DB tables + row counts |
| `npm run ai:classify-sample` | Smoke-test the classifier on 3 representative posts |
| `npm run ai:safety-test` | Run the safety filter against crafted blocker posts (14/14) |
| `npm run ai:draft-sample` | Smoke-test the drafter on 5 representative posts |

---

## Safety design

This is a mental-health adjacent brand commenting on real people's posts. Safety is the highest-stakes part of the system. The design:

- **Two layers of filtering.** Cheap rule-based filter runs first (catches obvious cases via regex/keywords with zero LLM cost), Claude's pre-flags catch subtler ones the rules miss.
- **Conservative bias.** Better to over-block and let a reviewer override than to ship a harmful comment.
- **Crisis-subreddit denylist.** The Reddit ingestor refuses to even fetch from `r/SuicideWatch`, `r/selfharm`, and similar — those communities shouldn't enter the pipeline at all.
- **Disclosure rule.** Any draft mentioning Sonia must start with the literal phrase `"I work on Sonia,"`. The post-generation safety check verifies this; drafts that name Sonia without disclosure are blocked.
- **Audit trail.** `decisions` is append-only. Every approve, edit, reject, and unsafe-flag is timestamped and preserves the reviewer's optional note.
- **No automated posting.** The pipeline ends at "draft saved, awaiting human." Posting happens manually outside the tool.

The 25 mock posts in `data/seed-posts.json` are crafted so at least one post exercises each safety category — see `scripts/ai-safety-test.ts` for the assertions (currently 14/14 passing).

---

## Tradeoffs and known limitations

- **Mock-first dataset.** 25 of the 30 posts are hand-crafted mocks. This is deliberate: it guarantees coverage of every safety category, and means the demo never depends on whatever Reddit happens to surface at runtime. Real Reddit ingestion works (see `npm run ingest:reddit`), it's just not the primary source.
- **No live posting integration.** Out of scope. The tool stops at draft + human decision — the assignment explicitly warned against acting in ways that get Sonia blocked on platforms.
- **Single-user, local-only.** No auth, no multi-reviewer, no deployed instance.
- **Mock post permalinks 404.** The 25 mock posts use fabricated URLs. Real Reddit posts have working permalinks.
- **Native module quirk on Node version upgrade.** `better-sqlite3` is a native module and may need `npm rebuild better-sqlite3` after switching Node versions.
- **Re-drafting during review is destructive.** Clicking "Re-draft all" overwrites existing drafts and cascade-deletes their decisions. This is intentional (it's the only way to apply a new prompt to old posts), but the UI confirms before running.
- **Concurrent edit safety not handled.** If you re-draft while reviewing the old version, the in-flight decision might race with the cascade-delete. Single-user assumption makes this a non-issue in practice.

---

## What I'd build next

If this became a production tool, the next things on the list:

- Multi-reviewer support with role-based queue assignment and SSO.
- Per-platform posting integrations with rate limits, per-account daily caps, and platform-specific TOS guardrails.
- Reviewer feedback loop: approve/reject signals → re-tune the drafter (or fine-tune a small model on confirmed-good drafts).
- Per-creator memory ("we've already engaged with this person 3x this week — back off").
- A/B testing of drafting prompts against real-world reply rates, not just internal review approval.
- Analytics: time-to-decision, approval rate by topic, post-comment engagement of approved drafts.
- Smarter classifier signals — author follower count, post age, comment count, prior decisions on similar posts.
- A second LLM pass that double-checks each approved comment from a fresh adversarial perspective before posting.
