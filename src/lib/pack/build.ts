import { verifyChain, type VerifiableEntry } from "@/lib/record/hash";
import { loadAgreements, loadEntries, loadFamilyContext } from "@/lib/record/queries";
import type { Agreement, RecordEntry } from "@/lib/types";

/**
 * An evidence pack is the record, for a date range, in a form someone else can
 * read and check: every message quoted in order, every agreement with its
 * history, and the integrity check for the range.
 *
 * It is always free. A record you have to pay to read is not a record.
 */

export interface PackData {
  generatedAt: Date;
  rangeStart: Date;
  rangeEnd: Date;
  parties: string[];
  childNames: string[];
  entries: RecordEntry[];
  agreements: Agreement[];
  integrity:
    | { ok: true; headHash: string; entryCount: number }
    | { ok: false; reason: string; brokenAtSeq: number };
}

export interface PackRequest {
  userId: string;
  from?: Date;
  to?: Date;
}

export async function buildPack(request: PackRequest): Promise<PackData | null> {
  const context = await loadFamilyContext(request.userId);
  if (!context) return null;

  const [allEntries, allAgreements] = await Promise.all([
    loadEntries(context.familyId, request.userId),
    loadAgreements(context.familyId, request.userId),
  ]);

  const from = request.from ?? new Date(0);
  const to = request.to ?? new Date();

  const entries = allEntries.filter((entry) => {
    const occurred = new Date(entry.occurredAt).getTime();
    return occurred >= from.getTime() && occurred <= to.getTime();
  });

  const entryIds = new Set(entries.map((entry) => entry.id));
  const agreements = allAgreements.filter((agreement) => entryIds.has(agreement.entryId));

  const verifiable: VerifiableEntry[] = entries.map((entry) => ({
    seq: entry.seq,
    family_id: context.familyId,
    kind: entry.kind,
    author_id: entry.authorId,
    occurred_at: entry.occurredAt,
    body: entry.body,
    prev_hash: entry.prevHash,
    hash: entry.hash,
  }));

  const verdict = verifyChain(verifiable);

  return {
    generatedAt: new Date(),
    rangeStart: entries.length > 0 ? new Date(entries[0]!.occurredAt) : from,
    rangeEnd:
      entries.length > 0 ? new Date(entries[entries.length - 1]!.occurredAt) : to,
    parties: [
      context.me.displayName,
      context.other?.displayName ?? "(other parent has not joined)",
    ],
    childNames: context.childNames,
    entries,
    agreements,
    integrity: verdict.ok
      ? { ok: true, headHash: verdict.headHash, entryCount: verdict.entryCount }
      : { ok: false, reason: verdict.reason, brokenAtSeq: verdict.brokenAtSeq },
  };
}
