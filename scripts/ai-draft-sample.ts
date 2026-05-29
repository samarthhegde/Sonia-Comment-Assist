import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import type { Post } from "../src/lib/types";
import { classifyPost } from "../src/lib/ai/classify";
import { generateDraft } from "../src/lib/ai/draft";
import { getClient, MODEL } from "../src/lib/ai/client";
import type { DraftShape } from "../src/lib/ai/variety";

// Expanded set — 6 draftable posts so we can actually see variety working,
// plus one blocker and one low-relevance for the negative cases.
const SAMPLE_IDS = [
  "post-001", // therapy reflection — draftable
  "post-002", // journaling tip — draftable
  "post-003", // boundary-setting therapist — draftable
  "post-005", // phone in the kitchen overnight — draftable
  "post-009", // therapy waitlist — draftable
  "post-013", // doomscroll quit — draftable
  "post-016", // crisis — blocked
  "post-022", // sourdough — skipped
];

async function main() {
  const handle = getClient();
  console.log(
    handle.kind === "real"
      ? `🟢 Using real Claude (${MODEL}).\n`
      : `🟡 ${handle.reason}\n`
  );

  const stmt = db.prepare("SELECT * FROM posts WHERE id = ?");

  // Sliding window of recent shapes — feeds the variety constraint.
  const recentShapes: DraftShape[] = [];
  const SHAPE_WINDOW = 4;

  for (const id of SAMPLE_IDS) {
    const post = stmt.get(id) as Post | undefined;
    if (!post) {
      console.log(`⚠️  ${id} not in DB — run npm run seed`);
      continue;
    }

    console.log("─".repeat(72));
    console.log(`POST ${id}  (${post.source} · ${post.author_handle})`);
    console.log(`> ${post.body.slice(0, 110)}${post.body.length > 110 ? "..." : ""}`);

    try {
      const t0 = Date.now();
      const classification = await classifyPost(post);
      const draft = await generateDraft(post, classification, { recentShapes });
      const ms = Date.now() - t0;

      console.log(
        `\n  relevance: ${classification.relevance_score}/100 (${classification.audience_match}) · ${ms}ms`
      );

      if (draft.draft_comment) {
        console.log(`\n  💬 DRAFT  (confidence ${draft.confidence}, shape: ${draft.shape})`);
        console.log(`     "${draft.draft_comment}"`);
        if (draft.mentions_sonia) console.log(`     [mentions Sonia]`);
        // Remember the shape for variety.
        if (draft.shape) {
          recentShapes.push(draft.shape);
          if (recentShapes.length > SHAPE_WINDOW) recentShapes.shift();
        }
      } else {
        console.log(`\n  🛑 ${draft.blocked_reason}`);
        if (draft.safety_flags.length > 0) {
          console.log(`     flags: [${draft.safety_flags.join(", ")}]`);
        }
      }
    } catch (err) {
      console.error(`  ❌ ${(err as Error).message}`);
    }
    console.log();
  }

  console.log("─".repeat(72));
  console.log(`Final shape window: [${recentShapes.join(", ")}]`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
