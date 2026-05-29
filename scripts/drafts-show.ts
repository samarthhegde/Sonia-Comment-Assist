import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";

type Row = {
  post_id: string;
  author_handle: string;
  source: string;
  relevance_score: number;
  draft_comment: string | null;
  blocked_reason: string | null;
  safety_flags: string;
  body: string;
};

const rows = db
  .prepare(
    `SELECT p.id AS post_id, p.author_handle, p.source, p.body,
            d.relevance_score, d.draft_comment, d.blocked_reason, d.safety_flags
       FROM posts p
       JOIN drafts d ON d.post_id = p.id
       ORDER BY d.relevance_score DESC`
  )
  .all() as Row[];

if (rows.length === 0) {
  console.log("No drafts in DB. Run: npm run process");
  process.exit(0);
}

for (const r of rows) {
  console.log("─".repeat(72));
  console.log(`[${r.relevance_score.toString().padStart(3)}] ${r.post_id} · ${r.source} · ${r.author_handle}`);
  console.log(`     > ${r.body.slice(0, 90).replace(/\n/g, " ")}${r.body.length > 90 ? "..." : ""}`);
  if (r.draft_comment) {
    console.log(`     💬 "${r.draft_comment}"`);
  } else {
    console.log(`     🛑 ${r.blocked_reason}`);
    const flags = JSON.parse(r.safety_flags) as string[];
    if (flags.length > 0) console.log(`        flags: [${flags.join(", ")}]`);
  }
}

console.log("─".repeat(72));
console.log(`${rows.length} drafts total`);
