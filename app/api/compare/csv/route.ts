import {
  loadLatestForCompare,
  parseLeaIds,
  toCsv,
} from "@/lib/compare-data";

export const revalidate = 3600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const leaids = parseLeaIds(url.searchParams.get("leaids") ?? undefined);
  if (leaids.length === 0) {
    return new Response("No leaids supplied\n", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const rows = await loadLatestForCompare(leaids);
  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compare-${leaids.join("-")}.csv"`,
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
