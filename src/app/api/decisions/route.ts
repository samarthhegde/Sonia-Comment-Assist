import { NextResponse } from "next/server";
import { z } from "zod";
import { insertDecision } from "@/lib/queries";
import { DecisionAction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  draft_id: z.string().min(1),
  action: DecisionAction,
  edited_comment: z.string().nullable().optional(),
  reviewer_note: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const decision = insertDecision(parsed.data);
    return NextResponse.json(decision);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
