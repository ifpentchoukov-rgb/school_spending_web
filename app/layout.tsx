import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "School Spending Tracker",
  description:
    "Per-LEA budget and actual expenditure tracking for U.S. K-12 public school districts.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/states", label: "States" },
  { href: "/rankings", label: "Rankings" },
  { href: "/coverage-map", label: "Coverage Map" },
  { href: "/methodology", label: "Methodology" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200 dark:border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 items-center justify-between">
              <Link
                href="/"
                className="font-semibold tracking-tight text-slate-900 dark:text-slate-100"
              >
                School Spending Tracker
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                {NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  href="/login"
                  className="ml-2 rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  Sign in
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 dark:border-slate-800 mt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              Public data from state DOEs and U.S. Census F-33 reporting frame.
              Source documents linked on every event.
            </span>
            <span>
              <Link href="/about" className="hover:text-slate-700 dark:hover:text-slate-200">
                About
              </Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
