import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd()); // pick up .env.local for scripts run via tsx

import { db } from "../src/lib/db";
import type { Post } from "../src/lib/types";
import { classifyPost } from "../src/lib/ai/classify";
import { getClient, MODEL } from "../src/lib/ai/client";

// Three hand-picked posts that span the relevance spectrum + one safety case.
const SAMPLE_IDS = [
  "post-001", // therapy reflection — should score high
  "post-019", // mushroom-cure promo — should pre-flag medical_claim + spam
  "post-022", // sourdough — should score low
];

async function main() {
  const handle = getClient();
  console.log(
    handle.kind === "real"
      ? `🟢 Using real Claude (${MODEL}).\n`
      : `🟡 ${handle.reason}\n   (Put ANTHROPIC_API_KEY in .env.local to use real Claude.)\n`
  );

  const stmt = db.prepare("SELECT * FROM posts WHERE id = ?");

  for (const id of SAMPLE_IDS) {
    const post = stmt.get(id) as Post | undefined;
    if (!post) {
      console.log(`⚠️  Post ${id} not found in DB. Did you run npm run seed?`);
      continue;
    }

    console.log("─".repeat(70));
    console.log(`POST ${id}  (${post.source} · ${post.author_handle})`);
    console.log(`> ${post.body.slice(0, 140)}${post.body.length > 140 ? "..." : ""}`);

    const t0 = Date.now();
    try {
      const result = await classifyPost(post);
      const ms = Date.now() - t0;
      console.log(`\nresult (${ms}ms):`);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`\n❌ Failed: ${(err as Error).message}`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
