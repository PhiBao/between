import { NextResponse } from "next/server";
import { buildPack } from "@/lib/pack/build";
import { renderPackPdf } from "@/lib/pack/pdf";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

/**
 * Streams the evidence pack and records that it was produced.
 *
 * The pack row is written with the user's own session, so RLS still applies:
 * a request can only ever export the record the caller belongs to.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));

  const pack = await buildPack({
    userId: user.id,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  if (!pack) {
    return NextResponse.json({ error: "no_record" }, { status: 404 });
  }
  if (pack.entries.length === 0) {
    return NextResponse.json({ error: "nothing_to_export" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: membership } = await supabase
    .from("memberships")
    .select("family_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membership) {
    await supabase.from("packs").insert({
      family_id: membership.family_id,
      created_by: user.id,
      range_start: pack.rangeStart.toISOString(),
      range_end: pack.rangeEnd.toISOString(),
      entry_count: pack.entries.length,
      agreement_count: pack.agreements.length,
      head_hash: pack.integrity.ok ? pack.integrity.headHash : "0".repeat(64),
    });
  }

  const pdf = await renderPackPdf(pack);
  const filename = `between-record-${pack.generatedAt.toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdf as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
