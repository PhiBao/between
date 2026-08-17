"use server";

import { z } from "zod";
import { verifyChain, type VerifiableEntry } from "@/lib/record/hash";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Verification has to work for someone who has no account — a mediator holding
 * a printed pack — so it runs with the service role. That makes the response
 * shape a security decision: it returns a verdict, a count and a date, and
 * never any content, names or identifiers.
 *
 * Lookup is by the pack's head hash, which is a 64-character SHA-256 digest and
 * therefore not guessable.
 */

const hashSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[0-9a-f]{64}$/, "A head hash is 64 letters and numbers.");

export type VerifyResult =
  | { status: "invalid_input"; message: string }
  | { status: "not_found" }
  | {
      status: "verified";
      entryCount: number;
      packCreatedAt: string;
      rangeStart: string;
      rangeEnd: string;
    }
  | { status: "altered"; reason: string };

export async function verifyPackHash(rawHash: string): Promise<VerifyResult> {
  const parsed = hashSchema.safeParse(rawHash);
  if (!parsed.success) {
    return {
      status: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "That does not look like a head hash.",
    };
  }

  const headHash = parsed.data;
  const admin = supabaseAdmin();

  const { data: pack } = await admin
    .from("packs")
    .select("family_id, created_at, range_start, range_end, entry_count")
    .eq("head_hash", headHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pack) return { status: "not_found" };

  const { data: rows } = await admin
    .from("entries")
    .select("seq, family_id, kind, author_id, occurred_at, body, prev_hash, hash")
    .eq("family_id", pack.family_id)
    .gte("occurred_at", pack.range_start)
    .lte("occurred_at", pack.range_end)
    .order("seq", { ascending: true });

  const verdict = verifyChain((rows ?? []) as VerifiableEntry[]);

  if (!verdict.ok) {
    return { status: "altered", reason: verdict.reason };
  }

  if (verdict.headHash !== headHash) {
    return {
      status: "altered",
      reason:
        "the record for this range no longer ends with the hash printed on the pack",
    };
  }

  return {
    status: "verified",
    entryCount: verdict.entryCount,
    packCreatedAt: pack.created_at as string,
    rangeStart: pack.range_start as string,
    rangeEnd: pack.range_end as string,
  };
}
