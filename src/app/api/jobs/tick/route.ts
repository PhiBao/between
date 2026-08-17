import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The scheduled tick.
 *
 * Called by a GitHub Actions cron (see .github/workflows/tick.yml) with a shared
 * secret. It does one thing: turn "confirmed but past due and never marked done"
 * into "missed", with an audit row.
 *
 * Deliberately idempotent and stateless — if a tick is missed, the next one
 * catches up, and nothing in the product depends on it having run, because
 * overdue is also computed when the record is read.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = env().CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin().rpc("mark_missed_agreements", {
    p_grace_hours: 24,
  });

  if (error) {
    return NextResponse.json({ error: "tick_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, markedMissed: data ?? 0 });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
