import { FilterTabs, type FilterKey } from "@/components/FilterTabs";
import { Logo } from "@/components/Logo";
import { PostCard } from "@/components/PostCard";
import { ProcessButton } from "@/components/ProcessButton";
import { listReviewItems, type ReviewItem } from "@/lib/queries";

export const dynamic = "force-dynamic";

function matchesFilter(item: ReviewItem, filter: FilterKey): boolean {
  const { draft, latestDecision } = item;
  switch (filter) {
    case "all":
      return true;
    case "awaiting":
      return Boolean(draft?.draft_comment) && !latestDecision;
    case "approved":
      return (
        latestDecision?.action === "approve" || latestDecision?.action === "edit"
      );
    case "rejected":
      return latestDecision?.action === "reject";
    case "unsafe":
      return latestDecision?.action === "unsafe";
    case "blocked":
      return Boolean(draft) && !draft?.draft_comment && (draft?.safety_flags.length ?? 0) > 0;
    case "skipped":
      return Boolean(draft) && !draft?.draft_comment && (draft?.safety_flags.length ?? 0) === 0;
    default:
      return true;
  }
}

const VALID_FILTERS: FilterKey[] = [
  "awaiting",
  "approved",
  "rejected",
  "unsafe",
  "blocked",
  "skipped",
  "all",
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter: FilterKey =
    params.filter && VALID_FILTERS.includes(params.filter as FilterKey)
      ? (params.filter as FilterKey)
      : "awaiting";

  const items = listReviewItems();

  const counts = VALID_FILTERS.reduce(
    (acc, key) => {
      acc[key] = items.filter((i) => matchesFilter(i, key)).length;
      return acc;
    },
    {} as Record<FilterKey, number>
  );

  const filtered = items.filter((i) => matchesFilter(i, filter));

  return (
    <>
      {/* Sticky app bar — stays at top while you scroll the queue. Makes the app
          feel like a real desktop product, not a webpage. */}
      <div className="sticky top-0 z-40 border-b border-stone-200/60 bg-[var(--background)]/85 backdrop-blur-md dark:border-stone-800/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">
                Sonia Health
              </span>
              <span className="text-sm font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                Comment Assist
              </span>
            </div>
          </div>
          <div className="hidden items-center gap-3 text-xs text-stone-500 sm:flex dark:text-stone-400">
            <span>
              <strong className="text-stone-700 dark:text-stone-200">
                {items.length}
              </strong>{" "}
              posts
            </span>
            <span className="text-stone-300 dark:text-stone-700">·</span>
            <span>
              <strong className="text-teal-700 dark:text-teal-400">
                {counts.awaiting}
              </strong>{" "}
              awaiting
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">
              Review queue
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
              Drafted, waiting for you.
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              AI-drafted replies on public posts, queued for human review. Specific, kind, useful — and safe.
            </p>
          </div>
          <ProcessButton />
        </header>

        <div className="mb-6">
          <FilterTabs active={filter} counts={counts} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState filter={filter} totalItems={items.length} />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((item) => (
              <PostCard key={item.post.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function EmptyState({
  filter,
  totalItems,
}: {
  filter: FilterKey;
  totalItems: number;
}) {
  if (totalItems === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-900">
        No posts yet. Run{" "}
        <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs dark:bg-stone-800">
          npm run seed
        </code>{" "}
        or{" "}
        <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs dark:bg-stone-800">
          npm run ingest:reddit -- r/&lt;sub&gt;
        </code>
        .
      </div>
    );
  }

  const messages: Record<FilterKey, { title: string; body: string }> = {
    awaiting: {
      title: "All caught up.",
      body: "Nothing waiting for review. Click 'Process new posts' if you've ingested more.",
    },
    approved: {
      title: "No approved comments yet.",
      body: "Approve a draft from the Awaiting tab and it'll show here.",
    },
    rejected: {
      title: "Nothing rejected.",
      body: "Drafts you reject will move here.",
    },
    unsafe: {
      title: "Nothing flagged as unsafe.",
      body: "Posts you mark unsafe — or confirm a safety block on — will show here.",
    },
    blocked: {
      title: "Nothing blocked.",
      body: "The safety filter hasn't blocked any of your sourced posts.",
    },
    skipped: {
      title: "Nothing skipped.",
      body: "Posts scoring below the relevance threshold will appear here.",
    },
    all: {
      title: "No posts match.",
      body: "Try ingesting some posts first.",
    },
  };

  const { title, body } = messages[filter];
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-10 text-center dark:border-stone-800 dark:bg-stone-900">
      <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{title}</p>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{body}</p>
    </div>
  );
}
