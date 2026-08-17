import { describe, expect, it } from "vitest";
import {
  canonicalTimestamp,
  entryCanonicalString,
  entryHash,
  verifyChain,
  ZERO_HASH,
  type VerifiableEntry,
} from "./hash";

const FAMILY = "11111111-1111-4111-8111-111111111111";
const ALICE = "22222222-2222-4222-8222-222222222222";
const BEN = "33333333-3333-4333-8333-333333333333";

function chain(bodies: string[]): VerifiableEntry[] {
  const entries: VerifiableEntry[] = [];
  let prevHash = ZERO_HASH;

  bodies.forEach((body, index) => {
    const seq = index + 1;
    const authorId = index % 2 === 0 ? ALICE : BEN;
    const occurredAt = new Date(Date.UTC(2026, 7, 10 + index, 9, 0, 0));
    const hash = entryHash({
      seq,
      familyId: FAMILY,
      kind: "sent",
      authorId,
      occurredAt,
      body,
      prevHash,
    });

    entries.push({
      seq,
      family_id: FAMILY,
      kind: "sent",
      author_id: authorId,
      occurred_at: occurredAt.toISOString(),
      body,
      prev_hash: prevHash,
      hash,
    });

    prevHash = hash;
  });

  return entries;
}

describe("canonicalTimestamp", () => {
  it("always renders UTC with millisecond precision", () => {
    expect(canonicalTimestamp(new Date("2026-08-17T05:06:07.089Z"))).toBe(
      "2026-08-17T05:06:07.089Z",
    );
    expect(canonicalTimestamp(new Date("2026-08-17T05:06:07Z"))).toBe(
      "2026-08-17T05:06:07.000Z",
    );
  });

  it("rejects an invalid date rather than hashing NaN", () => {
    expect(() => canonicalTimestamp(new Date("nonsense"))).toThrow();
  });
});

describe("entryHash", () => {
  it("is stable for the same inputs", () => {
    const input = {
      seq: 1,
      familyId: FAMILY,
      kind: "sent" as const,
      authorId: ALICE,
      occurredAt: new Date("2026-08-17T10:00:00.000Z"),
      body: "Pickup is 5pm on the 28th.",
      prevHash: ZERO_HASH,
    };
    expect(entryHash(input)).toBe(entryHash({ ...input }));
  });

  it("changes if any part of the entry changes", () => {
    const base = {
      seq: 1,
      familyId: FAMILY,
      kind: "sent" as const,
      authorId: ALICE,
      occurredAt: new Date("2026-08-17T10:00:00.000Z"),
      body: "Pickup is 5pm on the 28th.",
      prevHash: ZERO_HASH,
    };
    const original = entryHash(base);

    expect(entryHash({ ...base, body: "Pickup is 6pm on the 28th." })).not.toBe(original);
    expect(entryHash({ ...base, seq: 2 })).not.toBe(original);
    expect(entryHash({ ...base, authorId: BEN })).not.toBe(original);
    expect(entryHash({ ...base, kind: "logged_external" })).not.toBe(original);
    expect(
      entryHash({ ...base, occurredAt: new Date("2026-08-17T10:00:00.001Z") }),
    ).not.toBe(original);
  });

  it("hashes the body, so the canonical string stays fixed length", () => {
    const canonical = entryCanonicalString({
      seq: 1,
      familyId: FAMILY,
      kind: "sent",
      authorId: ALICE,
      occurredAt: new Date("2026-08-17T10:00:00.000Z"),
      body: "x".repeat(4000),
      prevHash: ZERO_HASH,
    });
    expect(canonical).not.toContain("xxxx");
    expect(canonical.split("|")).toHaveLength(7);
  });
});

describe("verifyChain", () => {
  it("accepts an untouched record and reports its head", () => {
    const entries = chain(["First message", "Second message", "Third message"]);
    const verdict = verifyChain(entries);

    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.entryCount).toBe(3);
      expect(verdict.headHash).toBe(entries[2]!.hash);
    }
  });

  it("accepts an empty range", () => {
    expect(verifyChain([])).toEqual({ ok: true, headHash: ZERO_HASH, entryCount: 0 });
  });

  it("detects an edited message", () => {
    const entries = chain(["First message", "Second message"]);
    entries[1]!.body = "Second message, quietly changed";

    const verdict = verifyChain(entries);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.brokenAtSeq).toBe(2);
      expect(verdict.reason).toContain("altered");
    }
  });

  it("detects a removed message", () => {
    const entries = chain(["one", "two", "three"]);
    const withHole = [entries[0]!, entries[2]!];

    const verdict = verifyChain(withHole);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain("missing");
    }
  });

  it("detects a reordered record", () => {
    const entries = chain(["one", "two", "three"]);
    const swapped = [entries[0]!, entries[2]!, entries[1]!];

    expect(verifyChain(swapped).ok).toBe(false);
  });

  it("verifies a partial range that chains onto earlier history", () => {
    const entries = chain(["one", "two", "three", "four"]);
    const verdict = verifyChain(entries.slice(1));

    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.entryCount).toBe(3);
  });
});
