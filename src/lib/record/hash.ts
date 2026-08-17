import { createHash } from "node:crypto";

/**
 * The record's integrity primitive.
 *
 * Every entry is hashed together with the hash of the entry before it, so the
 * whole record forms a chain. Changing or removing any past entry breaks every
 * hash after it, and an exported pack carries the head hash so it can be
 * checked later.
 *
 * This TypeScript implementation must produce byte-identical results to
 * `public.entry_canonical` in the database, because the database recomputes the
 * hash on insert and rejects the row if it disagrees. That double
 * implementation is deliberate: the client computes, the database verifies.
 */

export const ZERO_HASH = "0".repeat(64);

export type EntryKind = "sent" | "logged_external";

export interface ChainableEntry {
  seq: number;
  familyId: string;
  kind: EntryKind;
  authorId: string;
  /** Must be a UTC instant. */
  occurredAt: Date;
  body: string;
  prevHash: string;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Formats a timestamp exactly as Postgres does with
 * `to_char(ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
 * i.e. millisecond precision, always UTC.
 */
export function canonicalTimestamp(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new Error("canonicalTimestamp received an invalid date");
  }
  return date.toISOString().replace(/(\.\d{3})\d*Z$/, "$1Z");
}

export function entryCanonicalString(entry: ChainableEntry): string {
  return [
    String(entry.seq),
    entry.familyId,
    entry.kind,
    entry.authorId,
    canonicalTimestamp(entry.occurredAt),
    sha256Hex(entry.body),
    entry.prevHash,
  ].join("|");
}

export function entryHash(entry: ChainableEntry): string {
  return sha256Hex(entryCanonicalString(entry));
}

export interface VerifiableEntry {
  seq: number;
  family_id: string;
  kind: EntryKind;
  author_id: string;
  occurred_at: string;
  body: string;
  prev_hash: string;
  hash: string;
}

export type ChainVerdict =
  | { ok: true; headHash: string; entryCount: number }
  | { ok: false; reason: string; brokenAtSeq: number };

/**
 * Verifies a complete, ordered run of entries. Used by the public /verify page
 * and by the pack builder, so a reader never has to take the record on trust.
 */
export function verifyChain(entries: readonly VerifiableEntry[]): ChainVerdict {
  if (entries.length === 0) {
    return { ok: true, headHash: ZERO_HASH, entryCount: 0 };
  }

  let expectedPrev = ZERO_HASH;
  let expectedSeq = entries[0]!.seq;

  if (expectedSeq !== 1) {
    // A partial run is legitimate (a date range), so we only require that the
    // first entry chains onto what it claims, not that it is the very first.
    expectedPrev = entries[0]!.prev_hash;
  }

  for (const entry of entries) {
    if (entry.seq !== expectedSeq) {
      return {
        ok: false,
        reason: `expected entry ${expectedSeq} but found ${entry.seq} — an entry is missing`,
        brokenAtSeq: expectedSeq,
      };
    }
    if (entry.prev_hash !== expectedPrev) {
      return {
        ok: false,
        reason: `entry ${entry.seq} does not chain onto the previous entry`,
        brokenAtSeq: entry.seq,
      };
    }

    const recomputed = entryHash({
      seq: entry.seq,
      familyId: entry.family_id,
      kind: entry.kind,
      authorId: entry.author_id,
      occurredAt: new Date(entry.occurred_at),
      body: entry.body,
      prevHash: entry.prev_hash,
    });

    if (recomputed !== entry.hash) {
      return {
        ok: false,
        reason: `entry ${entry.seq} has been altered since it was recorded`,
        brokenAtSeq: entry.seq,
      };
    }

    expectedPrev = entry.hash;
    expectedSeq = entry.seq + 1;
  }

  return {
    ok: true,
    headHash: expectedPrev,
    entryCount: entries.length,
  };
}
