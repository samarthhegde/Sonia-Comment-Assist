function tier(score: number) {
  if (score >= 75)
    return {
      label: "Core fit",
      color: "bg-teal-50 text-teal-800 ring-teal-200/70 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-900/40",
    };
  if (score >= 50)
    return {
      label: "Good fit",
      color: "bg-sky-50 text-sky-800 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/40",
    };
  if (score >= 35)
    return {
      label: "Borderline",
      color: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700",
    };
  return {
    label: "Off-topic",
    color: "bg-stone-50 text-stone-500 ring-stone-200 dark:bg-stone-900 dark:text-stone-500 dark:ring-stone-800",
  };
}

export function RelevanceScore({ score }: { score: number }) {
  const { label, color } = tier(score);
  return (
    <span
      title={`Relevance: ${score}/100`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${color}`}
    >
      <span>{label}</span>
      <span className="opacity-50">·</span>
      <span className="font-semibold tabular-nums">{score}</span>
    </span>
  );
}
