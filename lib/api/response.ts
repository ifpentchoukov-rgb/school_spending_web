/**
 * Shared helpers for Phase 10 `/api/v1/*` route handlers.
 *
 * Conventions:
 *   - Responses are JSON-first with a `data` array and a `_meta` block.
 *   - `_meta` carries pagination plus a `coverage_caveats` array so the
 *     caller can surface honest limitations programmatically.
 *   - All endpoints honor a `?page=` / `?page_size=` pair, capped at
 *     500 (anonymous) / 5000 (researcher) per page.
 *   - Errors are also JSON: `{ error: { code, message } }`.
 */

export type ApiMeta = {
  page: number;
  page_size: number;
  total: number | null;
  has_next: boolean;
  coverage_caveats: string[];
};

export type ApiResponseBody<T> = {
  data: T[];
  _meta: ApiMeta;
};

export const DEFAULT_PAGE_SIZE = 50;
export const ANON_MAX_PAGE_SIZE = 500;
export const RESEARCHER_MAX_PAGE_SIZE = 5000;

export type Tier = "anonymous" | "researcher" | "admin";

export function parsePagination(
  url: URL,
  tier: Tier,
): { page: number; page_size: number } {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const requested = Number(url.searchParams.get("page_size")) || DEFAULT_PAGE_SIZE;
  const cap = tier === "researcher" || tier === "admin"
    ? RESEARCHER_MAX_PAGE_SIZE
    : ANON_MAX_PAGE_SIZE;
  const page_size = Math.max(1, Math.min(cap, requested));
  return { page, page_size };
}

export function offsetRange(page: number, page_size: number): [number, number] {
  const from = (page - 1) * page_size;
  return [from, from + page_size - 1];
}

export function jsonResponse<T>(
  body: ApiResponseBody<T>,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "X-Robots-Tag": "noindex",
      ...init.headers,
    },
    ...init,
  });
}

export function jsonError(
  code: string,
  message: string,
  status = 400,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ error: { code, message } }, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    },
  );
}

/**
 * Universal caveats every response carries. Endpoint-specific caveats
 * (e.g. "NY topline is GF-only") are appended per-route.
 */
export const UNIVERSAL_CAVEATS: string[] = [
  "Coverage is 45 states + DC (97.6% of US K-12 enrollment as of 2026-05).",
  "NYC DOE files separately from NY; not yet included in NY topline.",
  "NC topline is SPSF-state-funded only; not full-funds.",
  "Charter LEAs are not yet ingested for most states; non-charter operating districts only.",
];
