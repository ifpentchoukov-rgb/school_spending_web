"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getBrowserClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import type { Database } from "@/lib/types";

type Run = Pick<
  Database["public"]["Tables"]["extraction_runs"]["Row"],
  | "id"
  | "extractor_name"
  | "status"
  | "started_at"
  | "finished_at"
  | "records_extracted"
  | "records_changed"
  | "triggered_by"
  | "error_summary"
>;

export function RealtimeRunsList({ initial }: { initial: Run[] }) {
  const [runs, setRuns] = useState<Run[]>(initial);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel("extraction_runs:list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "extraction_runs" },
        (payload) => {
          setRuns((prev) => {
            const next = [...prev];
            const row = payload.new as Run;
            const old = payload.old as { id?: string };
            if (payload.eventType === "DELETE" && old?.id) {
              return next.filter((r) => r.id !== old.id);
            }
            const idx = next.findIndex((r) => r.id === row.id);
            if (idx >= 0) {
              next[idx] = row;
            } else {
              next.unshift(row);
            }
            return next.slice(0, 100);
          });
        },
      )
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 text-xs mb-3">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
          }`}
        />
        <span className="text-slate-500 dark:text-slate-400">
          {isLive ? "Live" : "Connecting…"} · {runs.length} runs
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Extractor</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Trigger</th>
              <th className="text-right px-4 py-2 font-medium">Extracted</th>
              <th className="text-right px-4 py-2 font-medium">Changed</th>
              <th className="text-left px-4 py-2 font-medium">Started</th>
              <th className="text-right px-4 py-2 font-medium">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {runs.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                >
                  No runs yet.
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <td className="px-4 py-2 font-mono text-slate-700 dark:text-slate-300">
                    <Link
                      href={`/admin/runs/${r.id}`}
                      className="hover:text-sky-600 dark:hover:text-sky-400"
                    >
                      {r.extractor_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {r.triggered_by}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(r.records_extracted)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatNumber(r.records_changed)}
                  </td>
                  <td
                    className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400"
                    suppressHydrationWarning
                  >
                    {r.started_at
                      ? new Date(r.started_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-slate-500 dark:text-slate-400">
                    {durationLabel(r.started_at, r.finished_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "failed"
        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
        : status === "partial"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${cls}`}>
      {status}
    </span>
  );
}

function durationLabel(started: string | null, finished: string | null) {
  if (!started || !finished) return "—";
  const ms = new Date(finished).getTime() - new Date(started).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
