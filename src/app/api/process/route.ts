import { NextResponse } from "next/server";
import { processAll } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const reprocess = url.searchParams.get("reprocess") === "true";

  try {
    const result = await processAll({ reprocess });
    const counts = { drafted: 0, blocked: 0, skipped: 0, failed: 0 };
    for (const r of result.results) counts[r.status]++;

    return NextResponse.json({
      total: result.total,
      counts,
      duration_ms: result.ms,
      results: result.results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
