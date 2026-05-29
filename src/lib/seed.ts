import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { db } from "./db";
import { PostSchema, type Post } from "./types";

const SEED_PATH = path.join(process.cwd(), "data", "seed-posts.json");

export type UpsertResult = { inserted: number; skipped: number; total: number };

/**
 * Idempotently insert a batch of posts. Existing IDs are silently skipped.
 * Shared between seed loading and live ingestion.
 */
export function upsertPosts(posts: Post[]): UpsertResult {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO posts
      (id, source, author_handle, author_url, body, permalink, created_at, raw_json)
    VALUES
      (@id, @source, @author_handle, @author_url, @body, @permalink, @created_at, @raw_json)
  `);

  let inserted = 0;
  const tx = db.transaction((batch: Post[]) => {
    for (const p of batch) {
      const info = insert.run(p);
      if (info.changes > 0) inserted++;
    }
  });
  tx(posts);

  return { inserted, skipped: posts.length - inserted, total: posts.length };
}

export function seedPosts(): UpsertResult {
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error(`Seed file not found at ${SEED_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  const posts: Post[] = z.array(PostSchema).parse(raw);
  return upsertPosts(posts);
}
