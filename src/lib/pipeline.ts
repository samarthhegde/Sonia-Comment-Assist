import { db } from "./db";
import type { Post } from "./types";
import { classifyPost, type Classification } from "./ai/classify";
import { generateDraft, type DraftResult } from "./ai/draft";
import type { DraftShape } from "./ai/variety";

export type ProcessResult = {
  post_id: string;
  draft_id: string;
  status: "drafted" | "blocked" | "skipped" | "failed";
  error?: string;
};

function persistDraft(
  postId: string,
  classification: Classification,
  draft: DraftResult
): string {
  const id = `draft-${postId}-${Date.now()}`;

  // Idempotent: remove any prior draft for this post before inserting the new one.
  // Decisions table cascades via FK, so old decisions tied to the old draft will
  // be removed too. (For this prototype that's fine — we're not preserving
  // decision history across re-processings.)
  db.prepare("DELETE FROM drafts WHERE post_id = ?").run(postId);

  db.prepare(
    `INSERT INTO drafts (
       id, post_id, relevance_score, relevance_rationale, topic_tags,
       draft_comment, mentions_sonia, safety_flags, blocked_reason,
       model, created_at
     ) VALUES (
       @id, @post_id, @relevance_score, @relevance_rationale, @topic_tags,
       @draft_comment, @mentions_sonia, @safety_flags, @blocked_reason,
       @model, @created_at
     )`
  ).run({
    id,
    post_id: postId,
    relevance_score: classification.relevance_score,
    relevance_rationale: classification.rationale,
    topic_tags: JSON.stringify(classification.topic_tags),
    draft_comment: draft.draft_comment,
    mentions_sonia: draft.mentions_sonia ? 1 : 0,
    safety_flags: JSON.stringify(draft.safety_flags),
    blocked_reason: draft.blocked_reason,
    model: draft.model,
    created_at: new Date().toISOString(),
  });

  return id;
}

export async function processPost(
  post: Post,
  recentShapes: DraftShape[] = []
): Promise<{ result: ProcessResult; shape: DraftShape | null }> {
  try {
    const classification = await classifyPost(post);
    const draft = await generateDraft(post, classification, { recentShapes });
    const draftId = persistDraft(post.id, classification, draft);

    let status: ProcessResult["status"] = "drafted";
    if (draft.draft_comment === null) {
      status = draft.safety_flags.length > 0 ? "blocked" : "skipped";
    }

    return {
      result: { post_id: post.id, draft_id: draftId, status },
      shape: draft.shape,
    };
  } catch (err) {
    return {
      result: {
        post_id: post.id,
        draft_id: "",
        status: "failed",
        error: (err as Error).message,
      },
      shape: null,
    };
  }
}

export type ProcessAllOptions = {
  reprocess?: boolean; // re-draft posts that already have a draft
  concurrency?: number;
};

export async function processAll(
  opts: ProcessAllOptions = {}
): Promise<{ total: number; results: ProcessResult[]; ms: number }> {
  const t0 = Date.now();
  const concurrency = opts.concurrency ?? 3;

  const posts = (
    opts.reprocess
      ? db.prepare("SELECT * FROM posts ORDER BY datetime(created_at) DESC")
      : db.prepare(
          `SELECT p.* FROM posts p
           LEFT JOIN drafts d ON d.post_id = p.id
           WHERE d.id IS NULL
           ORDER BY datetime(p.created_at) DESC`
        )
  ).all() as Post[];

  // Shape window flows across chunks (not within a chunk — parallel calls
  // can't see each other). Good enough for take-home batch sizes.
  const recentShapes: DraftShape[] = [];
  const SHAPE_WINDOW = 4;
  const results: ProcessResult[] = [];

  for (let i = 0; i < posts.length; i += concurrency) {
    const chunk = posts.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((p) => processPost(p, [...recentShapes]))
    );
    for (const { result, shape } of chunkResults) {
      results.push(result);
      if (shape) {
        recentShapes.push(shape);
        if (recentShapes.length > SHAPE_WINDOW) recentShapes.shift();
      }
    }
  }

  return { total: posts.length, results, ms: Date.now() - t0 };
}
