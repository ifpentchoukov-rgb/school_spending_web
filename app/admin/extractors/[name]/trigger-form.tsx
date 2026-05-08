"use client";

import { useState } from "react";

import { getBrowserClient } from "@/lib/supabase/client";

export function TriggerForm({ module }: { module: string }) {
  const [fy, setFy] = useState<number>(2025);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "queued"; triggerId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "submitting" });
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("extractor_triggers")
      .insert({
        module,
        fiscal_year: fy,
        status: "queued",
      })
      .select("id")
      .single();
    if (error) {
      setStatus({ kind: "error", message: error.message });
    } else {
      setStatus({ kind: "queued", triggerId: data!.id });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="fy"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          Fiscal year
        </label>
        <input
          id="fy"
          type="number"
          min={2000}
          max={2030}
          value={fy}
          onChange={(e) => setFy(Number(e.target.value))}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-mono"
        />
      </div>
      <button
        type="submit"
        disabled={status.kind === "submitting"}
        className="w-full rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {status.kind === "submitting" ? "Queueing…" : "Queue run"}
      </button>
      {status.kind === "queued" ? (
        <div className="text-xs text-emerald-700 dark:text-emerald-400">
          ✓ Trigger {status.triggerId.slice(0, 8)} queued. The
          GitHub Actions worker (or local cron) will pick it up.
        </div>
      ) : null}
      {status.kind === "error" ? (
        <div className="text-xs text-red-700 dark:text-red-400">
          ✗ {status.message}
        </div>
      ) : null}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Inserts an <code>extractor_triggers</code> row with{" "}
        <code>status='queued'</code>. A GitHub Actions workflow (TODO)
        polls for new rows and dispatches the extractor; the run feeds
        results back via <code>extraction_runs</code>.
      </p>
    </form>
  );
}
