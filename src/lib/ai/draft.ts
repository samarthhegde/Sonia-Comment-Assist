import { z } from "zod";
import type { Post, SafetyCategory } from "../types";
import { getClient, MODEL } from "./client";
import { SONIA_CONTEXT, COMMENT_STYLE_GUIDE } from "./prompts";
import type { Classification } from "./classify";
import { checkDraftSafety, checkPostSafety } from "./safety";
import {
  buildVarietyHint,
  capitalizeSentences,
  checkStyle,
  classifyShape,
  softSanitize,
  type DraftShape,
} from "./variety";

export type DraftResult = {
  draft_comment: string | null;
  mentions_sonia: boolean;
  safety_flags: SafetyCategory[];
  blocked_reason: string | null;
  confidence: number;
  shape: DraftShape | null;
  model: string;
};

const MIN_RELEVANCE_FOR_DRAFT = 35;

const RawDraftSchema = z.object({
  draft_comment: z.string().min(1).max(600),
  mentions_sonia: z.boolean(),
  confidence: z.number().min(0).max(100),
});

const DRAFT_SYSTEM_PROMPT = `${SONIA_CONTEXT}

${COMMENT_STYLE_GUIDE}

YOUR JOB
Draft a single short reply that the Sonia growth team will review before
posting. You do NOT post; a human does. Write something a thoughtful person
at Sonia would be proud to have shown up in their voice.

Output ONLY a single JSON object:
{
  "draft_comment": string (the comment itself — 1 or 2 short sentences),
  "mentions_sonia": boolean (true iff the comment names Sonia),
  "confidence": integer 0-100 (how good this comment is for THIS post)
}

ABSOLUTE RULES (you will be retried if you break any of these):
- No em dashes (—), en dashes (–), or double-hyphens (--). Use commas or
  periods. Two short sentences beat one sentence with an em dash.
- Do not open with: "really resonated", "this hit different", "this struck
  me", "as someone who", "sending love", "you got this", "this is so
  important", "i felt seen", "wow,", "omg,".
- If the calling system gives you a VARIETY CONSTRAINT, follow it.
- One emoji max. One exclamation mark max. Zero of either is usually right.

Output ONLY the JSON object. No markdown fences, no prose around it.`;

function buildUserPrompt(
  post: Post,
  classification: Classification,
  recentShapes: DraftShape[]
): string {
  return `POST TO REPLY TO

source: ${post.source}
author: ${post.author_handle}

body:
"""
${post.body}
"""

CLASSIFIER NOTES (for context only, do not quote)
- relevance: ${classification.relevance_score}/100
- audience: ${classification.audience_match}
- topics: ${classification.topic_tags.join(", ") || "(none)"}
- rationale: ${classification.rationale}
${buildVarietyHint(recentShapes)}

Draft the reply now.`;
}

// ---------------------------------------------------------------------------
// Real Claude path
// ---------------------------------------------------------------------------

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(`No JSON object found in draft output: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

async function callClaudeOnce(userPrompt: string): Promise<z.infer<typeof RawDraftSchema>> {
  const handle = getClient();
  if (handle.kind !== "real") throw new Error("callClaudeOnce called without real client");

  const res = await handle.client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: [
      {
        type: "text",
        text: DRAFT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Claude returned no text block");

  // Parse with one retry on bad JSON.
  try {
    return RawDraftSchema.parse(extractJson(block.text));
  } catch {
    // One more pass with same prompt — sometimes JSON gets mangled.
    const res2 = await handle.client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: [
        { type: "text", text: DRAFT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const b2 = res2.content.find((b) => b.type === "text");
    if (!b2 || b2.type !== "text") throw new Error("Claude retry returned no text block");
    return RawDraftSchema.parse(extractJson(b2.text));
  }
}

/**
 * Generate with style-retry: if the first attempt has banned openers or em
 * dashes, call again with a corrective hint. Final fallback is soft-sanitize.
 */
async function draftWithClaude(
  post: Post,
  classification: Classification,
  recentShapes: DraftShape[]
): Promise<z.infer<typeof RawDraftSchema>> {
  const userPrompt = buildUserPrompt(post, classification, recentShapes);
  const first = await callClaudeOnce(userPrompt);

  const issues = checkStyle(first.draft_comment);
  if (issues.length === 0) return first;

  // Retry once with explicit correction.
  const correction = `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED for: ${issues.join(", ")}.
Previous attempt: "${first.draft_comment}"
Rewrite without any em dash, without a banned opener, and varied from the
shapes listed above. Output JSON only.`;
  try {
    const second = await callClaudeOnce(userPrompt + correction);
    const stillBad = checkStyle(second.draft_comment);
    if (stillBad.length === 0) return second;
    // Last resort: soft-sanitize em dashes.
    return { ...second, draft_comment: softSanitize(second.draft_comment) };
  } catch {
    // If retry blows up, sanitize and return the first.
    return { ...first, draft_comment: softSanitize(first.draft_comment) };
  }
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

function draftMock(
  post: Post,
  classification: Classification
): z.infer<typeof RawDraftSchema> {
  const firstSentence = post.body.split(/[.!?]\s/)[0].slice(0, 80);
  return {
    draft_comment: `[mock-llm] noticed your "${firstSentence}". the part about ${classification.topic_tags[0] ?? "this"} stuck with me.`,
    mentions_sonia: false,
    confidence: 40,
  };
}

// ---------------------------------------------------------------------------
// Top-level
// ---------------------------------------------------------------------------

export type GenerateDraftOptions = {
  recentShapes?: DraftShape[];
};

export async function generateDraft(
  post: Post,
  classification: Classification,
  opts: GenerateDraftOptions = {}
): Promise<DraftResult> {
  const recentShapes = opts.recentShapes ?? [];

  // 1. Rule-layer + classifier safety on the post itself.
  const postSafety = checkPostSafety(post.body);
  const allFlags = new Set<SafetyCategory>([
    ...postSafety.hits.map((h) => h.category),
    ...classification.pre_safety_flags,
  ]);
  if (allFlags.size > 0) {
    const reason =
      postSafety.hits[0]?.reason ??
      `Classifier flagged: ${classification.pre_safety_flags.join(", ")}`;
    return {
      draft_comment: null,
      mentions_sonia: false,
      safety_flags: Array.from(allFlags),
      blocked_reason: `Blocked (post): ${reason}`,
      confidence: 0,
      shape: null,
      model: getClient().kind === "real" ? MODEL : "mock",
    };
  }

  // 2. Relevance gate.
  if (classification.relevance_score < MIN_RELEVANCE_FOR_DRAFT) {
    return {
      draft_comment: null,
      mentions_sonia: false,
      safety_flags: [],
      blocked_reason: `Skipped: relevance ${classification.relevance_score}/100 below threshold ${MIN_RELEVANCE_FOR_DRAFT}.`,
      confidence: 0,
      shape: null,
      model: getClient().kind === "real" ? MODEL : "mock",
    };
  }

  // 3. Generate.
  const handle = getClient();
  const raw =
    handle.kind === "real"
      ? await draftWithClaude(post, classification, recentShapes)
      : draftMock(post, classification);

  // 4. Draft-level safety.
  const draftSafety = checkDraftSafety(raw.draft_comment, { mentionsSonia: raw.mentions_sonia });
  if (draftSafety.blocked) {
    return {
      draft_comment: null,
      mentions_sonia: raw.mentions_sonia,
      safety_flags: draftSafety.hits.map((h) => h.category),
      blocked_reason: `Blocked (draft): ${draftSafety.hits.map((h) => h.reason).join(" · ")}`,
      confidence: raw.confidence,
      shape: null,
      model: handle.kind === "real" ? MODEL : "mock",
    };
  }

  // Final presentation: capitalize sentence starts so brand-voice comments
  // don't read as "trying-too-hard-casual." Shape classification happens on
  // the capitalized form so the labels match what the reviewer actually sees.
  const finalComment = capitalizeSentences(raw.draft_comment);

  return {
    draft_comment: finalComment,
    mentions_sonia: raw.mentions_sonia,
    safety_flags: [],
    blocked_reason: null,
    confidence: raw.confidence,
    shape: classifyShape(finalComment),
    model: handle.kind === "real" ? MODEL : "mock",
  };
}
