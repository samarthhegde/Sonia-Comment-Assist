import { DecisionBadge } from "./DecisionBadge";
import { DraftReview } from "./DraftReview";
import { RelevanceScore } from "./RelevanceScore";
import { SafetyBadge } from "./SafetyBadge";
import type { ReviewItem } from "@/lib/queries";

const SOURCE_STYLES: Record<string, string> = {
  reddit: "bg-orange-50 text-orange-700 ring-orange-200/70 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900/40",
  "twitter-mock": "bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/40",
  "instagram-mock": "bg-pink-50 text-pink-700 ring-pink-200/70 dark:bg-pink-950/40 dark:text-pink-300 dark:ring-pink-900/40",
  "tiktok-mock": "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700",
  blog: "bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PostCard({ item }: { item: ReviewItem }) {
  const { post, draft, latestDecision } = item;
  const sourceClass =
    SOURCE_STYLES[post.source] ?? "bg-stone-100 text-stone-700 ring-stone-200";

  return (
    <article className="rounded-xl border border-stone-200/60 bg-white p-5 shadow-[0_2px_6px_rgba(28,25,23,0.05),0_1px_2px_rgba(28,25,23,0.04)] transition-shadow hover:shadow-[0_4px_14px_rgba(28,25,23,0.08),0_2px_4px_rgba(28,25,23,0.05)] dark:border-stone-800 dark:bg-stone-900">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${sourceClass}`}>
          {post.source}
        </span>
        {post.author_url ? (
          <a
            href={post.author_url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-stone-800 hover:text-teal-700 hover:underline dark:text-stone-200 dark:hover:text-teal-400"
          >
            {post.author_handle}
          </a>
        ) : (
          <span className="font-medium text-stone-800 dark:text-stone-200">
            {post.author_handle}
          </span>
        )}
        <span className="text-stone-300 dark:text-stone-600">·</span>
        <time className="text-stone-500 dark:text-stone-400">{formatWhen(post.created_at)}</time>

        {draft && (
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            <RelevanceScore score={draft.relevance_score} />
            {draft.safety_flags.map((c) => (
              <SafetyBadge key={c} category={c} />
            ))}
            {latestDecision && <DecisionBadge action={latestDecision.action} />}
          </span>
        )}
      </header>

      <p className="mt-3.5 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800 dark:text-stone-200">
        {post.body}
      </p>

      {post.permalink && (
        <div className="mt-3 text-xs">
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer noopener"
            className="text-stone-400 hover:text-teal-700 hover:underline dark:text-stone-500 dark:hover:text-teal-400"
          >
            View original ↗
          </a>
        </div>
      )}

      {draft && <DraftReview draft={draft} latestDecision={latestDecision} />}
      {!draft && (
        <div className="mt-4 rounded-lg border border-dashed border-stone-300 p-3 text-xs text-stone-500 dark:border-stone-700">
          No draft yet — click{" "}
          <span className="font-medium text-stone-700 dark:text-stone-300">
            Process new posts
          </span>{" "}
          in the header.
        </div>
      )}
    </article>
  );
}
