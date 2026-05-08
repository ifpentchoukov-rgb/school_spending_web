import Link from "next/link";

export const metadata = { title: "Access denied" };

export default function AccessDeniedPage() {
  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8 py-16">
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 p-6">
        <h1 className="text-xl font-bold text-amber-900 dark:text-amber-200 mb-2">
          Access denied
        </h1>
        <p className="text-sm text-amber-800 dark:text-amber-300 mb-4">
          You're signed in, but your email isn't on the researcher allowlist.
          Public data is fully browsable without an account — researcher
          access is invite-only and used for verification + extractor
          triggers.
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          To request access, contact the project maintainer.
        </p>
        <div className="mt-6 flex gap-3 text-sm">
          <Link
            href="/"
            className="rounded-md bg-amber-600 dark:bg-amber-700 px-3 py-1.5 text-white hover:bg-amber-700 dark:hover:bg-amber-600"
          >
            Browse public data
          </Link>
          <Link
            href="/states"
            className="rounded-md border border-amber-300 dark:border-amber-800 px-3 py-1.5 text-amber-800 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-950/50"
          >
            All states
          </Link>
        </div>
      </div>
    </div>
  );
}
