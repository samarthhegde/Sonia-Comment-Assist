import type { DecisionAction } from "@/lib/types";

const STYLES: Record<DecisionAction, { label: string; color: string }> = {
  approve: {
    label: "✓ Approved",
    color: "bg-emerald-50 text-emerald-800 ring-emerald-200/70",
  },
  edit: {
    label: "✎ Edited",
    color: "bg-sky-50 text-sky-800 ring-sky-200/70",
  },
  reject: {
    label: "✗ Rejected",
    color: "bg-rose-50 text-rose-700 ring-rose-200/70",
  },
  unsafe: {
    label: "⚠ Unsafe",
    color: "bg-amber-50 text-amber-800 ring-amber-200/70",
  },
};

export function DecisionBadge({ action }: { action: DecisionAction }) {
  const { label, color } = STYLES[action];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${color}`}>
      {label}
    </span>
  );
}
