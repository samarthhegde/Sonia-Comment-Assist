"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Decision, DecisionAction, Draft } from "@/lib/types";

export function DraftReview({
  draft,
  latestDecision,
}: {
  draft: Draft;
  latestDecision: Decision | null;
}) {
  const router = useRouter();
  const originalDraft = draft.draft_comment ?? "";
  const initialText = latestDecision?.edited_comment ?? originalDraft;

  const [text, setText] = useState(initialText);
  const [note, setNote] = useState(latestDecision?.reviewer_note ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasDraft = draft.draft_comment !== null;
  const isBlocked = !hasDraft && draft.safety_flags.length > 0;
  const isSkipped = !hasDraft && draft.safety_flags.length === 0;

  async function submit(action: DecisionAction) {
    setError(null);
    const actuallyEdited =
      action === "approve" && text.trim() !== originalDraft.trim() && hasDraft;
    const finalAction: DecisionAction = actuallyEdited ? "edit" : action;
    const edited_comment = finalAction === "edit" ? text.trim() : null;

    startTransition(async () => {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft_id: draft.id,
          action: finalAction,
          edited_comment,
          reviewer_note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        setError(body || `Save failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-800">
      {isBlocked && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="font-medium text-rose-800 dark:text-rose-300">
            Blocked by safety filter
          </div>
          <div className="mt-0.5 text-rose-700/90 dark:text-rose-200/80">
            {draft.blocked_reason}
          </div>
        </div>
      )}

      {isSkipped && (
        <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-400">
          {draft.blocked_reason}
        </div>
      )}

      {hasDraft && (
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Draft {latestDecision?.action === "edit" ? "(edited)" : ""}
          </label>
          <textarea
            className="mt-1.5 w-full resize-y rounded-lg border border-stone-200 bg-stone-50/50 p-3 text-sm leading-relaxed text-stone-800 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-stone-700 dark:bg-stone-950/50 dark:text-stone-200 dark:focus:bg-stone-950"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            disabled={pending}
          />
          {draft.mentions_sonia && (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-400">
              <span>●</span> Mentions Sonia (disclosure required)
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Reviewer note (optional)
        </label>
        <input
          type="text"
          className="mt-1.5 w-full rounded-lg border border-stone-200 bg-stone-50/50 p-2.5 text-sm text-stone-800 transition-colors focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-stone-700 dark:bg-stone-950/50 dark:text-stone-200 dark:focus:bg-stone-950"
          placeholder="why you approved / rejected / flagged"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
        />
      </div>

      {latestDecision && (
        <div className="mt-2.5 text-xs text-stone-500 dark:text-stone-400">
          Last decision:{" "}
          <span className="font-medium text-stone-700 dark:text-stone-300">
            {latestDecision.action}
          </span>{" "}
          at {new Date(latestDecision.decided_at).toLocaleString()}
        </div>
      )}

      <div className="mt-3.5 flex flex-wrap gap-2">
        {hasDraft && (
          <button
            type="button"
            disabled={pending}
            onClick={() => submit("approve")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/95 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <span aria-hidden>✓</span> Approve
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("reject")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600/90 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("unsafe")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600/95 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
        >
          <span aria-hidden>⚠</span> Mark unsafe
        </button>
        {pending && (
          <span className="self-center text-xs text-stone-500">Saving…</span>
        )}
      </div>

      {error && (
        <div className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
    </div>
  );
}
