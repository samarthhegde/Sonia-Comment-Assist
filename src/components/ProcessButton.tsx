"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ProcessSummary = {
  total: number;
  counts: { drafted: number; blocked: number; skipped: number; failed: number };
  duration_ms: number;
};

type RunKind = "new" | "reprocess";

export function ProcessButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeKind, setActiveKind] = useState<RunKind | null>(null);
  const [summary, setSummary] = useState<ProcessSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  // Tick a live timer while a run is in flight so the user knows it's alive.
  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      startedAt.current = null;
      return;
    }
    startedAt.current = Date.now();
    const id = setInterval(() => {
      if (startedAt.current) setElapsed(Date.now() - startedAt.current);
    }, 500);
    return () => clearInterval(id);
  }, [pending]);

  function run(kind: RunKind) {
    setError(null);
    setSummary(null);
    setActiveKind(kind);
    startTransition(async () => {
      const url =
        kind === "reprocess" ? "/api/process?reprocess=true" : "/api/process";
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const t = await res.text();
        setError(t || `Failed (${res.status})`);
        setActiveKind(null);
        return;
      }
      const data: ProcessSummary = await res.json();
      setSummary(data);
      setActiveKind(null);
      router.refresh();
    });
  }

  const elapsedSec = Math.floor(elapsed / 1000);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("new")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
          title="Run the pipeline over any posts that don't have a draft yet (fast)"
        >
          {pending && activeKind === "new" ? (
            <>
              <Spinner /> Processing… {elapsedSec}s
            </>
          ) : (
            "Process new posts"
          )}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              confirm(
                "Re-draft all posts? This takes ~90–120 seconds and overwrites every existing draft + its decisions."
              )
            ) {
              run("reprocess");
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-700 dark:hover:bg-stone-700"
          title="Re-draft every post (overwrites existing drafts and any decisions)"
        >
          {pending && activeKind === "reprocess" ? (
            <>
              <Spinner /> {elapsedSec}s / ~120s
            </>
          ) : (
            "Re-draft all"
          )}
        </button>
      </div>
      {pending && (
        <div className="text-xs text-stone-500 dark:text-stone-400">
          {activeKind === "reprocess"
            ? "Sending all posts back through Claude. Don't close the tab."
            : "Working…"}
        </div>
      )}
      {summary && (
        <div className="text-xs text-stone-500 dark:text-stone-400">
          {summary.total === 0
            ? "Nothing new to process."
            : `${summary.total} processed in ${(summary.duration_ms / 1000).toFixed(1)}s · ${summary.counts.drafted} drafted, ${summary.counts.blocked} blocked, ${summary.counts.skipped} skipped`}
        </div>
      )}
      {error && <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
