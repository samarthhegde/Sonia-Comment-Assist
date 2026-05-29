import { z } from "zod";
import type { Post } from "../types";
import { SafetyCategory } from "../types";
import { getClient, MODEL } from "./client";
import { SONIA_CONTEXT } from "./prompts";

export const ClassificationSchema = z.object({
  relevance_score: z.number().int().min(0).max(100),
  rationale: z.string().min(1),
  topic_tags: z.array(z.string()).max(8),
  audience_match: z.enum(["core", "adjacent", "partner", "none"]),
  pre_safety_flags: z.array(SafetyCategory),
});
export type Classification = z.infer<typeof ClassificationSchema>;

const SYSTEM_PROMPT = `${SONIA_CONTEXT}

YOUR JOB
You score whether a public post is a good candidate for Sonia (a mental-health
support company) to draft a reply on. You also flag any obvious safety
problems with the POST itself, before any reply has been drafted.

Return ONLY a single JSON object with these exact keys:
{
  "relevance_score": integer 0-100,
  "rationale": short string (1-2 sentences explaining the score),
  "topic_tags": string[] (up to 8 short lowercase tags, e.g. "therapy", "burnout"),
  "audience_match": one of "core" | "adjacent" | "partner" | "none",
  "pre_safety_flags": string[] (zero or more of: "crisis", "minor", "medical_claim", "diagnosis_cure_prevention", "inappropriate_intervention", "privacy", "spam_manipulative")
}

SCORING GUIDE
- 80-100: core audience, conversation has substance, would benefit from a thoughtful reply
- 50-79: adjacent — mental-health-shaped but not directly inviting engagement
- 20-49: tangentially related (general productivity, lifestyle)
- 0-19: unrelated (sports, food, code, generic news)

Use pre_safety_flags liberally — better to flag now and let the safety filter
make the final call than to miss something.

Output ONLY the JSON. No prose, no markdown fences.`;

function buildUserPrompt(post: Post): string {
  return `POST TO CLASSIFY

source: ${post.source}
author: ${post.author_handle}
posted_at: ${post.created_at}

body:
"""
${post.body}
"""`;
}

// ---------------------------------------------------------------------------
// Real LLM path
// ---------------------------------------------------------------------------

function extractJson(text: string): unknown {
  // Tolerate accidental markdown fences or leading prose.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(`No JSON object found in model output: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

async function classifyWithClaude(post: Post): Promise<Classification> {
  const handle = getClient();
  if (handle.kind !== "real") throw new Error("classifyWithClaude called without real client");

  const userPrompt = buildUserPrompt(post);

  const callOnce = async () => {
    const res = await handle.client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Prompt caching — system prompt is ~stable, post body varies.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Claude returned no text block");
    }
    return block.text;
  };

  // Try once, retry once on parse failure with a stricter nudge.
  let raw = await callOnce();
  try {
    return ClassificationSchema.parse(extractJson(raw));
  } catch {
    raw = await callOnce();
    return ClassificationSchema.parse(extractJson(raw));
  }
}

// ---------------------------------------------------------------------------
// Mock fallback — deterministic, keyword-driven. Lets the rest of the
// pipeline run end-to-end without an API key. Not a replacement for Claude.
// ---------------------------------------------------------------------------

function classifyMock(post: Post): Classification {
  const text = post.body.toLowerCase();
  const has = (...words: string[]) => words.some((w) => text.includes(w));

  const flags: z.infer<typeof SafetyCategory>[] = [];
  if (
    has(
      "kill myself",
      "end it",
      "no point anymore",
      "don't want to wake up",
      "suicide",
      "self-harm",
      "relapsed"
    )
  ) {
    flags.push("crisis");
  }
  if (has("my 14", "my 15", "my 16", "my daughter", "my son", "my kid")) flags.push("minor");
  if (has("cured", "cures", "this stuff literally cures", "code ", "20% off", "link in bio")) {
    flags.push("medical_claim", "spam_manipulative");
  }
  if (has("(555)", "prescription", "pharmacy", "phone:", "call (")) flags.push("privacy");
  if (has("buried my", "passed away", "i'm not looking for advice")) {
    flags.push("inappropriate_intervention");
  }

  let score = 25;
  if (has("therapy", "therapist", "anxiety", "depression", "burnout", "journaling", "meditation"))
    score = 78;
  if (has("100 days", "sober", "recovery", "milestone")) score = 82;
  if (has("app", "founder", "building", "feedback")) score = 70;
  if (has("doomscroll", "phone", "sleep", "boundary")) score = 65;
  if (has("recipe", "sourdough", "halo", "lisbon", "sql", "left join")) score = 12;
  if (flags.length > 0) score = Math.min(score, 40);

  const audience_match: Classification["audience_match"] =
    score >= 75 ? "core" : score >= 50 ? "adjacent" : score >= 30 ? "partner" : "none";

  return {
    relevance_score: score,
    rationale: `[mock-llm] keyword-driven heuristic: matched ${flags.length} safety signal(s), score ${score}.`,
    topic_tags: Array.from(
      new Set(
        [
          has("therapy", "therapist") && "therapy",
          has("anxiety") && "anxiety",
          has("depression") && "depression",
          has("burnout") && "burnout",
          has("journaling") && "journaling",
          has("recovery", "sober") && "recovery",
          has("app", "founder", "building") && "indie-builder",
          flags.length > 0 && "safety-risk",
        ].filter(Boolean) as string[]
      )
    ).slice(0, 8),
    audience_match,
    pre_safety_flags: flags,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function classifyPost(post: Post): Promise<Classification> {
  const handle = getClient();
  if (handle.kind === "mock") return classifyMock(post);
  return classifyWithClaude(post);
}
