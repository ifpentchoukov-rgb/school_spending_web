"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getBrowserClient } from "@/lib/supabase/client";

type Status = "verified" | "flagged" | "disputed";

export function VerifyForm({
  eventId,
  parsedValue,
  currentStatus,
}: {
  eventId: string;
  parsedValue: number;
  currentStatus: string;
}) {
  const router = useRouter();
  const [observed, setObserved] = useState<string>(parsedValue.toString());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: Status) {
    setSubmitting(true);
    setError(null);

    const supabase = getBrowserClient();
    const { data: userResp } = await supabase.auth.getUser();
    const actor = userResp.user?.email ?? "unknown";

    // 1) Update budget_events.verification_*
    const { error: updErr } = await supabase
      .from("budget_events")
      .update({
        verification_status: action,
        verified_by: actor,
        verified_at: new Date().toISOString(),
        verification_notes: notes || null,
      })
      .eq("id", eventId);

    if (updErr) {
      setError(updErr.message);
      setSubmitting(false);
      return;
    }

    // 2) Append audit row
    const { error: logErr } = await supabase
      .from("verification_log")
      .insert({
        budget_event_id: eventId,
        actor,
        action,
        previous_status: currentStatus,
        new_status: action,
        notes: notes || null,
      });

    if (logErr) {
      setError(logErr.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="observed"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Observed value (in source document)
        </label>
        <input
          id="observed"
          type="text"
          inputMode="decimal"
          value={observed}
          onChange={(e) => setObserved(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-mono"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Compare against the parsed topline (
          <span className="font-mono">${parsedValue.toLocaleString()}</span>).
          If they match, click <strong>Verify</strong>. If not, flag with a
          note.
        </p>
      </div>
      <div>
        <label
          htmlFor="notes"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm"
          placeholder="What did you check? Where in the source?"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit("verified")}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          ✓ Verify
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit("flagged")}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        >
          ⚠ Flag
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit("disputed")}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          ✗ Dispute
        </button>
      </div>
      {error ? (
        <div className="text-xs text-red-700 dark:text-red-400">{error}</div>
      ) : null}
    </div>
  );
}
