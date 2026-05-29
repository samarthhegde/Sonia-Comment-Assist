/**
 * Tracks "shape" of recent drafts so we can ask Claude to vary openers
 * across a batch. Pure heuristics — no LLM call needed.
 */

export type DraftShape =
  | "question"
  | "quote-reframe"
  | "personal"
  | "fragment"
  | "observation";

const SHAPE_DESCRIPTIONS: Record<DraftShape, string> = {
  question: "opens with or is built around a question",
  "quote-reframe": "opens by quoting a phrase from the post, then reframing it",
  personal: "opens with first-person ('I', 'me', 'my')",
  fragment: "opens with a lowercase sentence fragment",
  observation: "opens with a direct declarative observation",
};

export function classifyShape(comment: string): DraftShape {
  const t = comment.trim();
  // Question: ends with ? or starts with what/how/why/when/where + ?
  if (t.endsWith("?")) return "question";
  // Quote-reframe: opens with a quote mark
  if (/^["'“‘]/.test(t)) return "quote-reframe";
  // Personal: opens with first-person
  if (/^(I |I'|i )/.test(t)) return "personal";
  // Fragment: opens lowercase with a noun/article (not a sentence starter)
  if (/^[a-z]/.test(t) && !/^(i|i'|i\s)/i.test(t)) return "fragment";
  return "observation";
}

/**
 * Inject a "recent shapes — avoid repeating" hint into the user prompt.
 * Returns an empty string if there's nothing to nudge against yet.
 */
export function buildVarietyHint(recentShapes: DraftShape[]): string {
  if (recentShapes.length === 0) return "";

  const counts: Partial<Record<DraftShape, number>> = {};
  for (const s of recentShapes) counts[s] = (counts[s] ?? 0) + 1;

  // Anything used 2+ times in the recent window is "overused" — push away.
  const overused = (Object.entries(counts) as [DraftShape, number][])
    .filter(([, c]) => c >= 2)
    .map(([s]) => s);

  const lastShape = recentShapes[recentShapes.length - 1];
  const avoid = new Set<DraftShape>(overused);
  avoid.add(lastShape); // never two in a row

  if (avoid.size === 0) return "";

  const avoidList = Array.from(avoid)
    .map((s) => `${s} (${SHAPE_DESCRIPTIONS[s]})`)
    .join("; ");

  return `\n\nVARIETY CONSTRAINT — IMPORTANT
Recent draft shapes (newest first): ${[...recentShapes].reverse().join(", ")}.
For THIS draft, do NOT use these opener shapes: ${avoidList}.
Pick a different shape so the review queue feels varied.`;
}

// ---------------------------------------------------------------------------
// Style sanity checks — used to decide whether to retry generation.
// ---------------------------------------------------------------------------

const BANNED_OPENER_PATTERNS: RegExp[] = [
  /^really resonated/i,
  /^this resonates/i,
  /^deeply resonated/i,
  /^this hit different/i,
  /^this hits/i,
  /^this struck me/i,
  /^this hit me/i,
  /^as someone who/i,
  /^sending love/i,
  /^you got this/i,
  /^this is so important/i,
  /^this is everything/i,
  /^i felt seen/i,
  /^felt so seen/i,
  /^wow,/i,
  /^omg,/i,
];

export type StyleIssue = "em-dash" | "banned-opener" | "too-long" | "multiple-exclaim";

export function checkStyle(comment: string): StyleIssue[] {
  const issues: StyleIssue[] = [];
  if (/[—–]|--/.test(comment)) issues.push("em-dash");
  if (BANNED_OPENER_PATTERNS.some((rx) => rx.test(comment.trim()))) {
    issues.push("banned-opener");
  }
  // 3+ sentences = too long
  const sentences = comment.split(/[.!?]+\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 3) issues.push("too-long");
  if ((comment.match(/!/g) ?? []).length > 1) issues.push("multiple-exclaim");
  return issues;
}

/**
 * Last-resort sanitizer. Replaces em/en dashes with a comma + space and
 * collapses any resulting double-spaces. Used when the model can't be
 * coaxed away from em dashes even after retry.
 */
export function softSanitize(comment: string): string {
  return comment
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*–\s*/g, ", ")
    .replace(/\s*--\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Capitalize the first letter of the comment and the first letter after
 * each sentence-ending period/exclaim/question. Leaves quoted phrases and
 * numeric openers (e.g. "47 days...") alone.
 */
export function capitalizeSentences(comment: string): string {
  let r = comment;
  // First letter at the very start of the string, if it's a lowercase letter.
  r = r.replace(/^([a-z])/, (c) => c.toUpperCase());
  // First letter after a sentence terminator.
  r = r.replace(/([.!?]+\s+)([a-z])/g, (_, punc, char) => punc + char.toUpperCase());
  return r;
}
