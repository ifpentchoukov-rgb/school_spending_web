import Link from "next/link";

import { getServerClient } from "@/lib/supabase/server";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/runs", label: "Runs" },
  { href: "/admin/extractors", label: "Extractors" },
  { href: "/admin/probe", label: "Probe" },
  { href: "/admin/users", label: "Allowlist" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerClient();
  const { data: userResp } = await supabase.auth.getUser();
  const email = userResp?.user?.email ?? "(unknown)";
  const role =
    (userResp?.user?.app_metadata?.role as string | undefined) ??
    "unknown";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3 mb-6 flex items-center justify-between">
        <nav className="flex items-center gap-1 text-sm">
          {ADMIN_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Signed in as{" "}
          <span className="font-mono text-slate-700 dark:text-slate-300">
            {email}
          </span>{" "}
          (
          <span
            className={
              role === "admin"
                ? "text-amber-700 dark:text-amber-400 font-medium"
                : role === "researcher"
                  ? "text-emerald-700 dark:text-emerald-400 font-medium"
                  : ""
            }
          >
            {role}
          </span>
          )
        </div>
      </div>
      {children}
    </div>
  );
}
