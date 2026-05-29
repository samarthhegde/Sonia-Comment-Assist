import { z } from "zod";
import type { Post } from "../types";
import { upsertPosts, type UpsertResult } from "../seed";

const USER_AGENT =
  "sonia-comment-assist/0.1 (engineering take-home prototype; read-only public ingest)";

// Subreddits we refuse to ingest from on principle: these are crisis-support
// or self-harm spaces. We should not run a "should we comment?" pipeline over
// them at all, independent of what the safety filter would do downstream.
const BLOCKED_SUBREDDITS = new Set([
  "suicidewatch",
  "selfharm",
  "selfharmpics",
  "stopselfharm",
  "depression_help", // crisis-leaning vs. r/depression which is mixed
  "anorexianervosa",
  "promortemtopics",
]);

const RedditChildSchema = z.object({
  kind: z.literal("t3"),
  data: z.object({
    id: z.string(),
    subreddit: z.string(),
    author: z.string(),
    title: z.string(),
    selftext: z.string().optional().default(""),
    permalink: z.string(),
    created_utc: z.number(),
    over_18: z.boolean().optional().default(false),
    stickied: z.boolean().optional().default(false),
    removed_by_category: z.string().nullable().optional(),
  }),
});

const RedditListingSchema = z.object({
  kind: z.literal("Listing"),
  data: z.object({
    children: z.array(z.unknown()),
  }),
});

export type IngestOptions = {
  subreddit: string;
  limit?: number;
  sort?: "hot" | "new" | "top";
};

export async function fetchSubreddit(opts: IngestOptions): Promise<Post[]> {
  const { subreddit, limit = 15, sort = "new" } = opts;
  const clean = subreddit.replace(/^r\//i, "").trim().toLowerCase();

  if (BLOCKED_SUBREDDITS.has(clean)) {
    throw new Error(
      `Refusing to ingest from r/${clean}: this is a crisis/self-harm support space. ` +
        `We do not run draft-comment pipelines over these communities.`
    );
  }

  const url = `https://www.reddit.com/r/${encodeURIComponent(clean)}/${sort}.json?limit=${limit}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Reddit fetch failed: ${res.status} ${res.statusText} (${url})`);
  }

  const json = await res.json();
  const listing = RedditListingSchema.parse(json);

  const posts: Post[] = [];
  for (const childRaw of listing.data.children) {
    const parsed = RedditChildSchema.safeParse(childRaw);
    if (!parsed.success) continue; // skip non-link items quietly
    const d = parsed.data.data;

    // Skip removed/deleted, stickied mod posts, NSFW, and empty self-posts.
    if (d.removed_by_category) continue;
    if (d.stickied) continue;
    if (d.over_18) continue;
    if (d.author === "[deleted]") continue;

    const body = [d.title, d.selftext].filter(Boolean).join("\n\n").trim();
    if (!body) continue;

    posts.push({
      id: `reddit-${d.id}`,
      source: "reddit",
      author_handle: `u/${d.author}`,
      author_url: `https://www.reddit.com/user/${d.author}`,
      body,
      permalink: `https://www.reddit.com${d.permalink}`,
      created_at: new Date(d.created_utc * 1000).toISOString(),
      raw_json: JSON.stringify({ id: d.id, subreddit: d.subreddit, sort }),
    });
  }

  return posts;
}

export async function ingestSubreddit(opts: IngestOptions): Promise<UpsertResult> {
  const posts = await fetchSubreddit(opts);
  return upsertPosts(posts);
}
