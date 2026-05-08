import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "default" | "primary" | "warn" | "muted";
  className?: string;
};

const accentClass: Record<NonNullable<Props["accent"]>, string> = {
  default: "border-slate-200 dark:border-slate-800",
  primary: "border-sky-500/40 bg-sky-50/50 dark:border-sky-500/30 dark:bg-sky-950/30",
  warn: "border-amber-500/40 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/30",
  muted: "border-slate-200/60 bg-slate-50 dark:border-slate-800 dark:bg-slate-900",
};

export function ToplineCard({
  label,
  value,
  sublabel,
  accent = "default",
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border p-5 flex flex-col gap-1",
        accentClass[accent],
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </div>
      {sublabel ? (
        <div className="text-sm text-slate-600 dark:text-slate-400">{sublabel}</div>
      ) : null}
    </div>
  );
}
