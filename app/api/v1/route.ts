/**
 * /api/v1 — index. Returns a minimal manifest of available endpoints
 * + rate-limit tiers + auth instructions. JSON so it's machine-readable;
 * the human-readable docs page is `/api/docs` (Phase 10.4 follow-up).
 */
export const revalidate = 86400;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}/api/v1`;

  const manifest = {
    name: "school-spending-tracker",
    version: "1.0.0",
    description:
      "Public read-only REST API for U.S. K-12 school district budgets and actuals.",
    base_url: base,
    endpoints: [
      {
        path: "/districts",
        method: "GET",
        params: [
          "state (postal, e.g. 'TX')",
          "entity_type (district|cooperative|charter)",
          "min_enrollment, max_enrollment (integers)",
          "page (default 1), page_size (default 50, capped)",
        ],
        description:
          "Paginated list of NCES-LEAID operating districts in our master.",
      },
      {
        path: "/districts/{leaid}",
        method: "GET",
        description:
          "Single district + all non-superseded budget events + their source documents + canonical-category components.",
      },
      {
        path: "/budget-events",
        method: "GET",
        params: [
          "state, leaid",
          "fiscal_year (integer)",
          "status (proposed|tentative|adopted|disapproved|actual)",
          "verification_status (unverified|verified|flagged|disputed)",
          "include_superseded (true to include; default false)",
          "page, page_size",
        ],
        description: "Per-LEA-per-FY topline events.",
      },
      {
        path: "/budget-event-components",
        method: "GET",
        params: [
          "category (expenditure_category enum value)",
          "state, fiscal_year",
          "page, page_size",
        ],
        description:
          "Canonical-category line-item breakdowns. NULL categories are absent (not zero).",
      },
      {
        path: "/states/{postal}/coverage",
        method: "GET",
        description:
          "State-level coverage stats: count of LEAs covered per (fiscal_year, status), plus the state's coverage_tier classification.",
      },
      {
        path: "/exports/budget-events.csv",
        method: "GET",
        params: ["fiscal_year (required)", "status", "state"],
        description: "Full FY snapshot as CSV. Hard cap 50k rows.",
      },
      {
        path: "/exports/budget-event-components.csv",
        method: "GET",
        params: ["fiscal_year (required)", "state", "category"],
        description: "Components for an FY as CSV. Hard cap 100k rows.",
      },
      {
        path: "/exports/districts.csv",
        method: "GET",
        description: "Full operating-district universe as CSV.",
      },
    ],
    auth: {
      type: "bearer-jwt",
      header: "Authorization: Bearer <supabase_jwt>",
      tiers: {
        anonymous: {
          rpm_target: 60,
          max_page_size: 500,
          access:
            "All read endpoints. Rate limiting is documentation-only in v1 (Vercel KV-backed enforcement on the roadmap).",
        },
        researcher: {
          rpm_target: 600,
          max_page_size: 5000,
          access:
            "Same surface as anonymous, plus elevated page-size caps and higher rate budgets. Granted by email allowlist — request via the contact form on /methodology.",
        },
        admin: {
          rpm_target: 0,
          max_page_size: 5000,
          access: "Unlimited.",
        },
      },
    },
    response_envelope: {
      success: '{"data": [...], "_meta": { "page", "page_size", "total", "has_next", "coverage_caveats" }}',
      error: '{"error": { "code", "message" }}',
    },
    canonical_categories: [
      "instruction",
      "support_services_student",
      "support_services_instruction",
      "administration",
      "operations_maintenance",
      "transportation",
      "food_service",
      "employee_benefits",
      "capital_outlay",
      "debt_service",
      "revenue_federal",
      "revenue_state",
      "revenue_local",
      "other",
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
