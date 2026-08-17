import { canonicalTimestamp, entryHash, ZERO_HASH } from "./hash";
import type { EntryKind } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Appends one entry to a family's record.
 *
 * The sequence number and hash are computed here and re-verified by a database
 * trigger, which also holds a per-family advisory lock. If two sends race, the
 * loser gets a chain error and retries with a fresh head — hence the retry
 * loop rather than a transaction the client cannot express.
 */

const MAX_ATTEMPTS = 4;

export interface AppendInput {
  familyId: string;
  kind: EntryKind;
  authorId: string;
  authorName: string;
  body: string;
  occurredAt: Date;
  rewriteUsed: boolean;
}

export interface AppendedEntry {
  id: string;
  seq: number;
  hash: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, "public", any>;

export async function appendEntry(
  supabase: Client,
  input: AppendInput,
): Promise<AppendedEntry> {
  let lastError: string = "unknown";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { data: head, error: headError } = await supabase
      .from("entries")
      .select("seq, hash")
      .eq("family_id", input.familyId)
      .order("seq", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (headError) throw new Error(`record_head_unreadable: ${headError.message}`);

    const seq = (head?.seq ?? 0) + 1;
    const prevHash = head?.hash ?? ZERO_HASH;

    // The timestamp is normalised to millisecond precision first, so the value
    // we hash is exactly the value the database will store and re-hash.
    const occurredAt = new Date(canonicalTimestamp(input.occurredAt));

    const hash = entryHash({
      seq,
      familyId: input.familyId,
      kind: input.kind,
      authorId: input.authorId,
      occurredAt,
      body: input.body,
      prevHash,
    });

    const { data, error } = await supabase
      .from("entries")
      .insert({
        family_id: input.familyId,
        seq,
        kind: input.kind,
        author_id: input.authorId,
        author_name: input.authorName,
        body: input.body,
        occurred_at: occurredAt.toISOString(),
        rewrite_used: input.rewriteUsed,
        prev_hash: prevHash,
        hash,
      })
      .select("id, seq, hash")
      .single();

    if (!error && data) {
      return { id: data.id as string, seq: data.seq as number, hash: data.hash as string };
    }

    lastError = error?.message ?? "insert_failed";

    const isRace =
      lastError.includes("prev_hash") ||
      lastError.includes("entry seq must be") ||
      lastError.includes("duplicate key");

    if (!isRace) break;
  }

  throw new Error(`append_failed: ${lastError}`);
}
