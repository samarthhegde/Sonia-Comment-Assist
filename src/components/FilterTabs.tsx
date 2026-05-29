import Link from "next/link";

export type FilterKey =
  | "awaiting"
  | "approved"
  | "rejected"
  | "unsafe"
  | "blocked"
  | "skipped"
  | "all";

const TABS: { id: FilterKey; label: string }[] = [
  { id: "awaiting", label: "Awaiting" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "unsafe", label: "Unsafe" },
  { id: "blocked", label: "Blocked" },
  { id: "skipped", label: "Skipped" },
  { id: "all", label: "All" },
];

export function FilterTabs({
  active,
  counts,
}: {
  active: FilterKey;
  counts: Record<FilterKey, number>;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.id === "awaiting" ? "/" : `/?filter=${tab.id}`}
            className={
              isActive
                ? "inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-colors dark:bg-teal-500"
                : "inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200 transition-colors hover:bg-stone-50 hover:text-stone-900 dark:bg-stone-900 dark:text-stone-400 dark:ring-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            }
          >
            <span>{tab.label}</span>
            <span
              className={
                isActive
                  ? "rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                  : "rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-stone-500 dark:bg-stone-800 dark:text-stone-400"
              }
            >
              {counts[tab.id]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
