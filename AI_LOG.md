# AI / Work Log

Honest disclosure of how AI was used while building this project.

## Two distinct uses of AI

1. **As the product itself** — Claude Sonnet 4.6 (via the Anthropic SDK) classifies posts and drafts comments at runtime. That's the AI workflow the assignment asked for.
2. **As a coding assistant** — Claude (via an agent IDE) was used as a pair-programmer during the build. Most of the code was AI-assisted typing-out of decisions I made.

This log is mostly about #2.

---

## What was human-driven — the decisions that mattered

Designing this as growth tooling meant thinking past "does Claude write good comments" toward how the system scales without burning Sonia's brand, budget, or reviewer time.

- **4-stage pipeline architecture** (classify → safety on post → draft → safety on draft). Splitting these lets each stage be tuned or swapped independently — the classifier can be downgraded to a cheaper model later, the safety filter can be hardened without touching prompts, the drafter can be A/B tested in isolation. Cleaner than one mega-prompt that does everything.
- **Prompt caching as a cost-at-scale lever.** The system prompt (~1.5k tokens of Sonia context + style guide) is marked for ephemeral cache. At 1 post it's rounding error; at 1k posts/day on the same cached prefix, it's a ~90% input-token cost reduction. This is the kind of architectural choice that pays off only as volume grows — built it in from day one.
- **Mock LLM fallback as a real engineering artifact.** Built a deterministic mock that mirrors the real LLM's interface, so the app runs end-to-end without an API key. Lets anyone clone the repo and demo without burning credits, and lets me run safety-filter regression tests independent of API availability or rate limits.
- **Mock-first dataset, deliberately.** Live scraping introduces fragility and can't guarantee coverage of every safety category. Hand-crafting 25 posts with one deliberate trap per category gave me 14 deterministic assertions in `ai-safety-test.ts` — every prompt change is regression-tested against the same fixtures. That's the production-shape version of "trust me, the safety works."
- **Defense-in-depth on safety as a brand-risk decision.** Two layers: rule-based pre/post filter (cheap, deterministic, zero LLM cost) plus the LLM classifier's own pre-flags (catches subtler signals the rules miss). Plus the crisis-subreddit denylist on the ingestor itself, so those communities never enter the pipeline. The conservative bias is deliberate: a false positive costs a reviewer ten seconds; a false negative could cost Sonia a platform.
- **Style guide as configuration, not code.** Sonia's voice lives in `src/lib/ai/prompts.ts` as a plain-text constant. A brand or growth lead can iterate the voice without touching engineering — which matters the moment this becomes a real internal tool with multiple stakeholders.
- **Sonia disclosure rule with code-level enforcement.** The model is instructed to start any Sonia mention with the literal phrase `"I work on Sonia,"` — and a regex post-check enforces it. Prompt rules alone aren't enough at scale for anything brand-critical; you need a code guarantee.
- **Append-only decisions table.** No mutations on past decisions. Edits create a new row. This is the audit-trail shape any compliance-sensitive product needs from day one, not retrofitted after a problem.
- **Variety constraint as cross-batch state.** Each draft is classified into a shape; the next prompt is told what shapes to avoid. The pipeline gets *more* varied as the batch progresses instead of falling into one repeated pattern. Important once you're drafting at any volume.
- **Reviewer UX choices.** Editing-then-approving logged as `edit` not `approve` preserves the audit distinction. "Awaiting" as the default filter so reviewers land on actionable work. Contextual empty states per filter so the tool always tells you what's next.

---

## What was AI-assisted

- **Boilerplate code.** Type definitions, Zod schemas, SQLite migrations, API route scaffolding, Tailwind class lists. The structure was specified by me; the typing-out was Claude.
- **Prompt iteration.** I'd review batches of generated drafts, identify a class of problem ("all using em-dashes", "voice reads as cold critic"), and have Claude revise the prompt. Each revision was tested against the same fixed posts to verify the change fixed the issue without regressing others.
- **UI components.** Tailwind classes, React state for the review queue, the sticky app bar. AI generated drafts; I directed patterns (server components for reads, client components only where interactivity required it).
- **This file + README.** Drafted by AI from a project summary, then read for accuracy.

---

## What was *not* AI-generated

- **APPROACH.md** — written by hand per the assignment's explicit instruction. AI was not used to draft or polish that document.
- **The 25 mock posts** in `data/seed-posts.json` — hand-written to ensure every safety category had a deliberate trap post, plus realistic relevant content and pure noise. The hand-crafting is what makes the safety test suite meaningful.

---

## Cost

With prompt caching active, per-post cost stays roughly flat as volume grows:

- One classify call: ~1k input tokens (mostly cached after the first call) + ~200 output tokens.
- One draft call: ~1.5k input tokens (mostly cached) + ~150 output tokens.
- Full pipeline over 30 posts: ~$0.05–$0.15 depending on style retries.

At 1000 posts/day that's roughly $2–5/day in inference — well inside any realistic growth-tool budget.

Development cost — Claude as coding assistant for the entire build — used a fraction of the $5 prepaid credit.

---

## What I'd do differently with more time

- **Eval harness.** A small script that runs the pipeline over a fixed golden set and asserts: relevance scores within bands for known-relevant posts, safety flags fire for known blockers, draft style doesn't regress. Right now I eyeball drafts after each prompt change. At scale, that's a quality problem.
- **Adversarial second pass.** A "would Sonia be embarrassed by this?" LLM check on every approved draft before it's queued for posting. Cheap insurance against the small percentage of drafts the safety filter and reviewer both miss.
- **Real-data safety set.** Expand the safety test set with examples drawn from real archived public posts (with permission), not just hand-crafted mocks. Mocks are deterministic but stylized — real posts have edge cases the crafter doesn't think of.
- **Per-creator memory.** Track when Sonia has engaged with the same account recently and back off. Prevents the tool from accidentally turning into the kind of pattern that gets accounts flagged on most platforms.
