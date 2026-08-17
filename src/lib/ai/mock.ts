import { compareFacts } from "@/lib/safety/facts";
import { screenRisk, SUPPORT_MESSAGE } from "@/lib/safety/risk";
import type {
  AiProvider,
  CandidateAgreement,
  RewriteOutcome,
} from "./types";

/**
 * A deterministic, offline provider.
 *
 * This exists so the product is fully runnable with no API key and no network —
 * for local development, for tests that must not depend on a model's mood, and
 * for anyone evaluating the project.
 *
 * It is rule-based, not a model, and the interface says so: when this provider
 * is active the UI labels the suggestion as offline demo mode. Nothing here is
 * presented to the user as AI output.
 */

const HOSTILE_PHRASES: readonly RegExp[] = [
  /\byou always\b/gi,
  /\byou never\b/gi,
  /\btypical\b/gi,
  /\bobviously\b/gi,
  /\bas usual\b/gi,
  /\bagain\b/gi,
  /\bunbelievable\b/gi,
  /\bpathetic\b/gi,
  /\bselfish\b/gi,
  /\blazy\b/gi,
  /\bgrow up\b/gi,
  /\blike a child\b/gi,
  /\bi'?m done chasing you\b/gi,
  /\byou'?re impossible\b/gi,
];

function deShout(text: string): { text: string; changed: boolean } {
  let changed = false;
  const result = text.replace(/\b[A-Z]{3,}\b/g, (word) => {
    if (word === "OK") return word;
    changed = true;
    return word.charAt(0) + word.slice(1).toLowerCase();
  });
  return { text: result, changed };
}

function tidy(text: string): string {
  return text
    .replace(/([!?])\1+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/(^|[.!?]\s+)([a-z])/g, (_match, lead: string, letter: string) =>
      `${lead}${letter.toUpperCase()}`,
    )
    .replace(/\.\s*\./g, ".")
    .trim();
}

export function createMockProvider(): AiProvider {
  return {
    name: "offline-demo",
    model: "rule-based",

    async rewrite({ text, childNames }): Promise<RewriteOutcome> {
      const risk = screenRisk(text);
      if (risk.blockRewrite && risk.level !== "ok") {
        return {
          status: "blocked_safety",
          level: risk.level,
          message: SUPPORT_MESSAGE[risk.level],
        };
      }

      const removed: string[] = [];
      let working = text;

      for (const pattern of HOSTILE_PHRASES) {
        working = working.replace(pattern, (match) => {
          removed.push(match);
          return "";
        });
      }

      const shouted = deShout(working);
      working = tidy(shouted.text);

      const whatChanged: string[] = [];
      if (removed.length > 0) whatChanged.push("Removed blaming and dismissive phrases");
      if (shouted.changed) whatChanged.push("Turned shouting into ordinary sentences");
      if (/([!?])\1/.test(text)) whatChanged.push("Calmed the punctuation");

      if (working.length === 0 || whatChanged.length === 0) {
        return { status: "unchanged", reason: "already_neutral" };
      }

      // The offline path is held to exactly the same standard as the model.
      const facts = compareFacts(text, working, childNames);
      if (!facts.ok) {
        return {
          status: "blocked_facts",
          missing: facts.missing,
          invented: facts.invented,
        };
      }

      return {
        status: "suggested",
        suggestion: working,
        whatChanged,
        removedPhrases: [...new Set(removed.map((phrase) => phrase.trim()))].filter(
          (phrase) => phrase.length > 0,
        ),
      };
    },

    async extractAgreements({ text, now }): Promise<CandidateAgreement[]> {
      const found: CandidateAgreement[] = [];

      // Sentences that contain a commitment verb plus a concrete detail.
      const sentences = text.split(/(?<=[.!?])\s+/);
      const commitmentRe =
        /\b(?:i'?ll|i will|i can|i am going to|i'?m going to|please|can you|could you|you need to)\b/i;
      const detailRe =
        /(?:[$£€]\s?\d+|\b\d{1,2}(?::[0-5]\d)?\s?(?:am|pm)\b|\b\d{1,2}(?:st|nd|rd|th)\b|\b\d{4}-\d{2}-\d{2}\b)/i;

      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length < 8) continue;
        if (!commitmentRe.test(trimmed) || !detailRe.test(trimmed)) continue;

        const asksOther = /\b(?:please|can you|could you|you need to)\b/i.test(trimmed);
        found.push({
          text: trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed,
          sourceQuote: trimmed,
          owner: asksOther ? "other" : "author",
          dueAt: guessDue(trimmed, now),
        });
        if (found.length === 3) break;
      }

      return found;
    },
  };
}

/** Resolves "the 28th" or "5pm on the 28th" against the current month. */
function guessDue(sentence: string, now: Date): Date | null {
  const iso = sentence.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const day = sentence.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  const time = sentence.match(/\b(\d{1,2})(?::([0-5]\d))?\s?(am|pm)\b/i);

  let base: Date | null = null;
  if (iso?.[1]) {
    base = new Date(`${iso[1]}T12:00:00Z`);
  } else if (day?.[1]) {
    const dayNumber = Number.parseInt(day[1], 10);
    if (dayNumber >= 1 && dayNumber <= 31) {
      base = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayNumber, 12, 0, 0),
      );
      if (base.getTime() < now.getTime() - 86_400_000) {
        base = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, dayNumber, 12, 0, 0),
        );
      }
    }
  }

  if (!base) return null;

  if (time?.[1]) {
    let hour = Number.parseInt(time[1], 10);
    const minute = time[2] ? Number.parseInt(time[2], 10) : 0;
    const meridiem = time[3]?.toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    base.setUTCHours(hour, minute, 0, 0);
  }

  return base;
}
