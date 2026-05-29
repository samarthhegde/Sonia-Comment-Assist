import { db } from "./db";
import type {
  Decision,
  DecisionAction,
  Draft,
  Post,
  SafetyCategory,
} from "./types";

export function listPosts(): Post[] {
  return db
    .prepare(
      `SELECT id, source, author_handle, author_url, body, permalink, created_at, raw_json
       FROM posts
       ORDER BY datetime(created_at) DESC`
    )
    .all() as Post[];
}

export function countPosts(): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM posts").get() as { c: number };
  return row.c;
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export type ReviewItem = {
  post: Post;
  draft: Draft | null;
  latestDecision: Decision | null;
};

type DraftRow = {
  id: string;
  post_id: string;
  relevance_score: number;
  relevance_rationale: string;
  topic_tags: string;
  draft_comment: string | null;
  mentions_sonia: number;
  safety_flags: string;
  blocked_reason: string | null;
  model: string;
  created_at: string;
};

function hydrateDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    post_id: row.post_id,
    relevance_score: row.relevance_score,
    relevance_rationale: row.relevance_rationale,
    topic_tags: JSON.parse(row.topic_tags) as string[],
    draft_comment: row.draft_comment,
    mentions_sonia: row.mentions_sonia === 1,
    safety_flags: JSON.parse(row.safety_flags) as SafetyCategory[],
    blocked_reason: row.blocked_reason,
    model: row.model,
    created_at: row.created_at,
  };
}

export function listReviewItems(): ReviewItem[] {
  const posts = listPosts();
  const draftStmt = db.prepare("SELECT * FROM drafts WHERE post_id = ?");
  const decisionStmt = db.prepare(
    "SELECT * FROM decisions WHERE draft_id = ? ORDER BY id DESC LIMIT 1"
  );

  const items: ReviewItem[] = posts.map((post) => {
    const draftRow = draftStmt.get(post.id) as DraftRow | undefined;
    if (!draftRow) return { post, draft: null, latestDecision: null };

    const draft = hydrateDraft(draftRow);
    const decRow = decisionStmt.get(draft.id) as Decision | undefined;
    return { post, draft, latestDecision: decRow ?? null };
  });

  // Sort: unreviewed drafts first (highest relevance), reviewed/skipped after.
  items.sort((a, b) => {
    const aReviewed = a.latestDecision !== null;
    const bReviewed = b.latestDecision !== null;
    if (aReviewed !== bReviewed) return aReviewed ? 1 : -1;
    const aScore = a.draft?.relevance_score ?? -1;
    const bScore = b.draft?.relevance_score ?? -1;
    return bScore - aScore;
  });

  return items;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export type InsertDecisionInput = {
  draft_id: string;
  action: DecisionAction;
  edited_comment?: string | null;
  reviewer_note?: string | null;
};

export function insertDecision(input: InsertDecisionInput): Decision {
  const decided_at = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO decisions (draft_id, action, edited_comment, reviewer_note, decided_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.draft_id,
      input.action,
      input.edited_comment ?? null,
      input.reviewer_note ?? null,
      decided_at
    );

  return {
    id: Number(info.lastInsertRowid),
    draft_id: input.draft_id,
    action: input.action,
    edited_comment: input.edited_comment ?? null,
    reviewer_note: input.reviewer_note ?? null,
    decided_at,
  };
}
