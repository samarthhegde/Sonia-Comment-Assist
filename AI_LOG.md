# AI / Work Log

A short note on how AI was used during this build.

## Two ways I used AI

1. **In the product** — Claude Sonnet 4.6 classifies posts and drafts comments at runtime. That's the AI workflow the assignment asked for.
2. **As a coding assistant** — Claude served as a pair programmer throughout the build.

This log is mostly about #2.

---

## What I decided (not the AI)

- **Pipeline shape.** Four stages: classify → safety check on the post → draft → safety check on the draft. Splitting it this way means each stage can be tuned or swapped without rewriting the others.
- **Mock dataset over scraping.** I needed every safety category to have a test post. Random Reddit content can't guarantee that. The 25 mocks are deliberate test cases for the safety filter.
- **Two safety layers.** Cheap rule-based checks first, Claude's safety flags second. Over-blocking is fine; missing something isn't.
- **Crisis-subreddit denylist.** Spaces like r/SuicideWatch shouldn't enter the pipeline at all. That's enforced at the ingestor itself, before any classification runs.
- **Sonia disclosure rule.** Any draft mentioning Sonia has to start with `"I work on Sonia,"` — verified by code after generation, not left to the prompt alone.
- **Style guide as text.** Sonia's voice lives in a plain text constant in `src/lib/ai/prompts.ts` so a non-engineer could iterate on it without touching the codebase.
- **Append-only decisions.** Editing an approval creates a new row, not an overwrite. Decisions never disappear, which keeps a clean audit trail from day one.
- **Variety constraint.** The first round of drafts all sounded the same. I added a step that classifies each draft's shape and tells Claude what shapes the recent batch already used, so it picks something different next.
- **Reviewer UX.** Editing then approving logs as `edit` rather than `approve` — preserves the audit distinction. Each filter tab has a contextual empty state so the queue always tells you what's next.

---

## What Claude helped with

- Boilerplate — types, Zod schemas, SQLite migrations, Tailwind class lists. I described the shape; Claude typed it.
- Prompt iteration — I'd read a batch of drafts, name the problem (too cold-clever, all using em-dashes, repetitive shape), have Claude revise the style guide, then re-run and verify the fix didn't regress anything else.
- UI components — React state for the review queue, the sticky app bar, filter tab styling.
- This file and the README.

---

## What I wrote by hand

- **APPROACH.md** — I wanted my own reasoning on the page, not an AI summary of it.
- **The 25 mock posts.** Designed each one to test something specific: at least one deliberate trap per safety category, paired with realistic relevant content and intentional noise so the relevance threshold gets exercised too.

---

## Cost

Tiny, mostly because the system prompt is cached. Claude only re-tokenizes the short post body on each call, not the full ~1.5k-token Sonia voice + style guide that sits on top.

- Per post: a small fraction of a cent — closer to $0.001 than $0.01 once caching is warm.
- Full pipeline over all 30 posts: 5–15 cents total.

---

## What I'd add with more time

- An eval set — run the pipeline against a fixed group of posts and assert that key signals (scores, safety flags, draft style) don't regress when I tweak the prompt.
- A second LLM check on approved drafts before they leave the queue, as a final adversarial pass that asks "would Sonia be embarrassed if this got posted?"
- Per-creator memory — back off if Sonia has already engaged with the same account recently.
- A wider safety test set drawn from real public posts (with permission), not just hand-crafted mocks.
