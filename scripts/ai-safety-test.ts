import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { db } from "../src/lib/db";
import type { Post, SafetyCategory } from "../src/lib/types";
import { checkPostSafety } from "../src/lib/ai/safety";

// What we EXPECT each crafted blocker post to flag. The test asserts that
// each expected category is present (extra flags are OK — we err on the
// side of over-flagging).
const EXPECTED: Record<string, SafetyCategory[]> = {
  "post-016": ["crisis"], // desperate tweet
  "post-017": ["crisis"], // self-harm relapse
  "post-018": ["minor"], // 14-year-old daughter
  "post-019": ["medical_claim", "diagnosis_cure_prevention", "spam_manipulative"],
  "post-020": ["privacy"], // prescription + phone
  "post-021": ["inappropriate_intervention"], // recent widow
};

// Posts that should NOT flag anything at the post level.
const CLEAN_IDS = [
  "post-001",
  "post-002",
  "post-003",
  "post-005",
  "post-007",
  "post-010",
  "post-022", // sourdough — noise but not unsafe
  "post-024", // travel
];

let passed = 0;
let failed = 0;

function check(post: Post, expected: SafetyCategory[] | "clean") {
  const result = checkPostSafety(post.body);
  const got = result.hits.map((h) => h.category);

  if (expected === "clean") {
    if (got.length === 0) {
      console.log(`✅ ${post.id} clean (as expected)`);
      passed++;
    } else {
      console.log(`❌ ${post.id} expected clean, got [${got.join(", ")}]`);
      failed++;
    }
    return;
  }

  const missing = expected.filter((c) => !got.includes(c));
  if (missing.length === 0) {
    console.log(
      `✅ ${post.id} flagged [${got.join(", ")}] (expected at least [${expected.join(", ")}])`
    );
    passed++;
  } else {
    console.log(
      `❌ ${post.id} missing [${missing.join(", ")}] — got [${got.join(", ") || "none"}]`
    );
    failed++;
  }
}

const stmt = db.prepare("SELECT * FROM posts WHERE id = ?");

console.log("BLOCKERS (should flag):");
for (const [id, expected] of Object.entries(EXPECTED)) {
  const post = stmt.get(id) as Post | undefined;
  if (!post) {
    console.log(`⚠️  ${id} not in DB — run npm run seed`);
    continue;
  }
  check(post, expected);
}

console.log("\nCLEAN POSTS (should NOT flag):");
for (const id of CLEAN_IDS) {
  const post = stmt.get(id) as Post | undefined;
  if (!post) continue;
  check(post, "clean");
}

console.log(`\n${passed} passed · ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
