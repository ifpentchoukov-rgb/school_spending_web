# school_spending_web

Public + researcher portal for the [school-spending tracker](https://github.com/ifpentchoukov-rgb/school_spending). Browses per-LEA budget and actual expenditure data sourced directly from state DOEs and Census F-33 reporting.

**Live at https://school-spending-web.vercel.app**

Built with Next.js 16 (App Router), Supabase (Postgres + Auth + Storage), and Tailwind. Deployed on Vercel. Auto-updates via Supabase database webhooks when scheduled extractors land new data.

---

## Stack

- **Framework** — Next.js 16, App Router, React 19, TypeScript strict
- **Data** — Supabase (Postgres) via `@supabase/ssr` server clients
- **Styling** — Tailwind CSS 4
- **Auth** — Supabase magic-link, with a `researcher_allowlist` invite gate
- **Deploy** — Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
npm run dev
```

Visit http://localhost:3000.

The repo reads from the same Supabase project as the Python extractors. RLS policies on the database side already permit anonymous read of `districts`, `budget_events` (non-superseded), `source_documents` metadata, `extraction_runs`, `state_calendars`, plus the new portal tables (`extractor_triggers`, `probe_runs` are public-read; `researcher_allowlist` is gated behind `is_verifier()`).

## Project layout

```
app/
├── layout.tsx                 — Global header/nav/footer
├── page.tsx                   — Coverage dashboard
├── states/
│   ├── page.tsx               — All states index (live + deferred tables)
│   └── [postal]/
│       └── page.tsx           — Per-state showcase: timeline, sources, LEAs
└── api/
    └── revalidate/route.ts    — Supabase DB webhook target

components/
└── topline-card.tsx

lib/
├── supabase/
│   ├── server.ts              — Server-side client (RSC, route handlers)
│   └── client.ts              — Browser client (Realtime, interactive)
├── types.ts                   — Generated Supabase schema types
├── state-meta.ts              — Static state postal/name/enrollment meta
└── utils.ts                   — formatDollars / formatNumber / cn
```

## Auto-update — how it works

When a Python extractor (`extractors/*.py` in the sister repo) lands new budget events, the site refreshes within ~10 seconds. Three layers:

1. **Supabase DB webhook → /api/revalidate** (primary). On `INSERT`/`UPDATE` to `budget_events` or `extraction_runs`, Supabase POSTs to this Next.js route, which calls `revalidatePath` / `revalidateTag` for the affected pages.
2. **Realtime push** for admin pages. `/admin/runs` subscribes to `postgres_changes` on `extraction_runs` for sub-second updates.
3. **24h ISR safety net** on every public page. Even if a webhook fails, content is at most one day stale.

### Deploy-time webhook config

Once the site is live on Vercel:

1. Generate a strong secret:

   ```bash
   openssl rand -hex 32
   ```

2. Add it as `SUPABASE_WEBHOOK_SECRET` in:
   - Vercel project Environment Variables (Production + Preview)
   - Supabase Dashboard → Database → Webhooks → Headers (`x-webhook-secret`)

3. Create webhooks in Supabase Dashboard (Database → Webhooks):

   | Name                    | Table              | Events       | URL                                              |
   |-------------------------|--------------------|--------------|--------------------------------------------------|
   | revalidate-budget-events | `budget_events`    | INSERT, UPDATE | `https://<your-domain>/api/revalidate`          |
   | revalidate-runs          | `extraction_runs`  | UPDATE       | `https://<your-domain>/api/revalidate`          |
   | revalidate-triggers      | `extractor_triggers` | INSERT, UPDATE | `https://<your-domain>/api/revalidate`        |

   Add header `x-webhook-secret: <SUPABASE_WEBHOOK_SECRET value>` on each.

4. Trigger a manual extractor run — confirm the page reflects new data within ~10 seconds of the run committing.

## Roles + auth (Phase B, in progress)

- **Anonymous** — full read of public data
- **Researcher** — verifies events and triggers extractors. Granted on first sign-in if email is in `researcher_allowlist` (managed by admins via `/admin/users`).
- **Admin** — manages allowlist; same writes as researcher

The `is_verifier()` Postgres function gates verifier writes; an Auth Hook (`assign-researcher-role` Edge Function, planned) sets `app_metadata.role` based on allowlist membership.

## Deploy

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_WEBHOOK_SECRET production
vercel --prod
```

## Type generation

When the Supabase schema changes (new tables, new views, new enums), regenerate `lib/types.ts`:

```bash
# Via Supabase MCP from the parent repo, or:
npx supabase gen types typescript --project-id bwkgcofsxubdofklpsaw > lib/types.ts
```
