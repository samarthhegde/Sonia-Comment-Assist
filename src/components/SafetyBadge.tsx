import type { SafetyCategory } from "@/lib/types";

// Tiered by severity:
// - rose (red-ish): hard-block cases — never engage
// - amber: caution — review carefully
// - stone: lighter signal
const SAFETY_LABELS: Record<SafetyCategory, { label: string; color: string }> = {
  crisis: {
    label: "Crisis",
    color: "bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40",
  },
  minor: {
    label: "Minor",
    color: "bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40",
  },
  inappropriate_intervention: {
    label: "Don't engage",
    color: "bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40",
  },
  medical_claim: {
    label: "Medical claim",
    color: "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
  },
  diagnosis_cure_prevention: {
    label: "Cure language",
    color: "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
  },
  privacy: {
    label: "Privacy",
    color: "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
  },
  spam_manipulative: {
    label: "Spam",
    color: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700",
  },
};

export function SafetyBadge({ category }: { category: SafetyCategory }) {
  const { label, color } = SAFETY_LABELS[category];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${color}`}>
      {label}
    </span>
  );
}
