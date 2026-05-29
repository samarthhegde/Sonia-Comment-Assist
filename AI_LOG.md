# AI / Work Log

How AI was used while building this.

## Two ways I used AI

1. **In the product** — Claude Sonnet 4.6 classifies posts and drafts comments at runtime. That's the AI workflow the assignment asked for.
2. **As a coding assistant** — Claude pair-programmed with me during the build.

This log is mostly about #2.

---

## What I decided (not the AI)

- **Pipeline shape.** Four stages: classify → safety check on the post → draft → safety check on the draft. Splitting it this way means each stage can be tuned or swapped without rewriting the others.
- **Mock dataset over scraping.** I needed every safety category to have a test post. Random Reddit content can't guarantee that. The 25 mocks are deliberate test cases.
- **Two safety layers.** Cheap rule-based checks first, Claude's safety flags second. Over-blocking is fine; missing something isn't.
- **Crisis-subreddit denylist.** Spaces like r/SuicideWatch shouldn't enter the pipeline at all. That's hardcoded into the ingestor.
- **Sonia disclosure rule.** Any draft mentioning Sonia has to start with `"I work on Sonia,"` — verified by code, not just the prompt.
- **Style guide as text.** Sonia's voice lives in a plain text constant in `src/lib/ai/prompts.ts` so a non-engineer could edit it.
- **Append-only decisions.** Editing an approval creates a new row, not an overwrite. Decisions never disappear.
- **Variety constraint.** The first round of drafts all sounded the same — so I added a step that tells Claude what shapes the recent drafts used, and to pick something different.
- **Reviewer UX.** Editing then approving logs as "edit" not "approve." Empty states tell you what's next.

---

## What Claude helped with

- Boilerplate — types, Zod schemas, SQLite migrations, Tailwind class lists. I described the shape; Claude typed it.
- Prompt iteration — I'd read a batch of drafts, name the problem, have Claude revise the style guide. Then re-run and check.
- UI components.
- This file and the README.

---

## What I wrote by hand

- **APPROACH.md** — the assignment said to.
- **The 25 mock posts.** I designed each one to test something specific in the safety filter.

---

## Cost

Tiny. The system prompt is cached so it isn't re-tokenized each call.

- Per post: under a cent.
- Full pipeline over all 30 posts: 5–15 cents.
- The whole build: a fraction of $5.

---

## What I'd add with more time

- An eval set — run the pipeline against fixed posts and assert nothing regresses when I change the prompt.
- A second LLM check on approved drafts before they leave the queue.
- Per-creator memory — back off if Sonia has engaged with the same account recently.
- A wider safety test set drawn from real posts, not just hand-crafted mocks.
