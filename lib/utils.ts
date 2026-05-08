import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class-name merger (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a dollar amount with the most readable unit:
 *   1_234         -> "$1,234"
 *   12_345        -> "$12,345"
 *   1_234_567     -> "$1.23M"
 *   1_234_567_890 -> "$1.23B"
 *
 * For tabular display where you want consistent units, pass `forceUnit`.
 */
export function formatDollars(
  amount: number | null | undefined,
  opts: { forceUnit?: "M" | "B"; precision?: number } = {},
): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const { forceUnit, precision = 1 } = opts;
  const abs = Math.abs(amount);

  if (forceUnit === "B" || (!forceUnit && abs >= 1e9)) {
    return `$${(amount / 1e9).toFixed(precision)}B`;
  }
  if (forceUnit === "M" || (!forceUnit && abs >= 1e6)) {
    return `$${(amount / 1e6).toFixed(precision)}M`;
  }
  if (abs >= 1e3) {
    return `$${(amount / 1e3).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(
  n: number | null | undefined,
  opts: { precision?: number } = {},
): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: opts.precision ?? 0,
  });
}

export function formatPercent(
  n: number | null | undefined,
  opts: { precision?: number; signed?: boolean } = {},
): string {
  if (n == null || Number.isNaN(n)) return "—";
  const { precision = 1, signed = false } = opts;
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(precision)}%`;
}
