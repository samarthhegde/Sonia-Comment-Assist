import { z } from "zod";

// A public post we've ingested (mock dataset for the prototype).
export const PostSchema = z.object({
  id: z.string(),
  source: z.string(), // 'reddit' | 'twitter-mock' | 'instagram-mock' | 'tiktok-mock' | 'blog'
  author_handle: z.string(),
  author_url: z.string().nullable(),
  body: z.string(),
  permalink: z.string().nullable(),
  created_at: z.string(), // ISO timestamp
  raw_json: z.string().nullable(),
});
export type Post = z.infer<typeof PostSchema>;

// All possible safety categories the rubric calls out.
export const SafetyCategory = z.enum([
  "crisis",
  "minor",
  "medical_claim",
  "diagnosis_cure_prevention",
  "inappropriate_intervention",
  "privacy",
  "spam_manipulative",
]);
export type SafetyCategory = z.infer<typeof SafetyCategory>;

// One AI pass over a post: relevance + draft + safety verdict.
export const DraftSchema = z.object({
  id: z.string(),
  post_id: z.string(),
  relevance_score: z.number().int().min(0).max(100),
  relevance_rationale: z.string(),
  topic_tags: z.array(z.string()),
  draft_comment: z.string().nullable(),
  mentions_sonia: z.boolean(),
  safety_flags: z.array(SafetyCategory),
  blocked_reason: z.string().nullable(),
  model: z.string(),
  created_at: z.string(),
});
export type Draft = z.infer<typeof DraftSchema>;

// A reviewer's decision on a draft. Append-only audit trail.
export const DecisionAction = z.enum(["approve", "edit", "reject", "unsafe"]);
export type DecisionAction = z.infer<typeof DecisionAction>;

export const DecisionSchema = z.object({
  id: z.number().int(),
  draft_id: z.string(),
  action: DecisionAction,
  edited_comment: z.string().nullable(),
  reviewer_note: z.string().nullable(),
  decided_at: z.string(),
});
export type Decision = z.infer<typeof DecisionSchema>;
