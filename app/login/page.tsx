import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — School Spending Tracker",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8 py-16">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-1">
          Sign in
        </h1>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
          Researchers receive a magic link by email. Public data is browsable
          without an account — sign-in is only required for verification and
          extractor triggers.
        </p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
