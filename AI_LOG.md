# AI / Work Log

Honest disclosure of how AI was used while building this project.

## Two distinct uses of AI

1. **As the product itself** — Claude Sonnet 4.6 (via the Anthropic SDK) is what classifies posts and drafts comments at runtime. That's the AI workflow the assignment asked for.
2. **As a coding assistant** — Claude (via an agent IDE) was used as a pair-programmer during the build. Most of the code was AI-assisted.

This log is mostly about #2.

---

## What was human-driven (the decisions that mattered)

- **Scope and architecture.** Choosing Next.js + SQLite + Anthropic SDK over alternatives. Deciding on the 4-stage pipeline (classify → post-safety → draft → draft-safety). Deciding to use a mock dataset as the demo path while still building a live Reddit ingestor for credibility.
- **Why a mock dataset.** Trade-off call: real scraping introduces fragility and can't guarantee coverage of every safety category. Mocked 25 posts with deliberate variety in the safety categories was the choice that maximized rubric coverage and demo reliability.
- **Safety categories and the conservative bias.** The decision to over-block rather than under-block, and to bake the crisis-subreddit denylist into the ingestor itself (so the "should we draft for this?" pipeline never even sees those posts), was a deliberate product call.
- **Style guide content.** What "Sonia voice" should sound like — kind without saccharine, specific without analytical-critic energy, substance leading, warmth attached to specifics. The wording in `src/lib/ai/prompts.ts` was iterated based on reading actual generated drafts and saying "no, this still reads as cold/clever."
- **The Sonia disclosure rule.** Designing the requirement that any Sonia mention must start with `"I work on Sonia,"` and making the safety filter enforce it post-generation.
- **The variety constraint design.** Sliding shape window across a batch, prompt injection telling Claude what shapes to avoid for the next post. That was a deliberate response to seeing the first round of drafts all do the same prose move.
- **Reviewer UX choices.** Append-only decisions, editing-then-approving logged as `edit` not `approve`, contextual empty states per filter, "Awaiting" as the default filter so reviewers land on work to do.

---

## What was AI-assisted

- **Boilerplate code.** Type definitions, Zod schemas, SQLite migrations, API route scaffolding, Tailwind class lists. The shape was specified by me; the typing-out was AI.
- **Prompt iteration.** I'd review batches of drafts, note specific problems ("too cold-clever", "all using em-dashes"), and have Claude revise the prompt and the style guide. Each revision was tested against the same mock posts to confirm the issue resolved without regressing others.
- **UI components.** The Tailwind classes, the React state management for the review queue, the sticky app bar. AI generated drafts; I directed which patterns to use (server components for data fetching, client components only where interactivity needed it).
- **Documentation drafts** (this file, README) were drafted by AI from a project summary and then read for accuracy.

---

## What was *not* AI-generated

- **APPROACH.md** — written by hand per the assignment's explicit instruction. AI was not used to draft or polish that document.
- **The 25 mock posts** in `data/seed-posts.json` — hand-written to ensure every safety category had a deliberate trap post, plus realistic relevant content and pure noise. Mocking these by hand let me design the test cases the safety filter would prove itself on.

---

## Cost

The runtime cost of using Claude is low. With prompt caching on the system prompt:

- One classify call: ~1k input tokens (mostly cached after the first call) + ~200 output tokens.
- One draft call: ~1.5k input tokens (mostly cached) + ~150 output tokens.
- Full pipeline run over 30 posts: ~$0.05–$0.15 depending on retries.

Development cost — the entire build (Claude as coding assistant) — used a fraction of the $5 prepaid credit on the Anthropic account.

---

## What I'd do differently with more time

- Build a small eval harness that runs the pipeline over a fixed set of golden posts and asserts that key signals (relevance score for known-relevant posts, safety flags for known blockers) don't regress when the prompt changes. Right now I eyeball the drafts after each prompt edit.
- A second adversarial LLM pass on approved drafts before they're queued for posting (in the production version), as a final "would Sonia be embarrassed by this?" gate.
- Write the safety filter against a wider test set with examples drawn from real archived public posts (with permission), not just hand-crafted mocks.
