import { env } from "@/lib/env";
import { compareFacts } from "@/lib/safety/facts";
import { mergeRisk, screenRisk, SUPPORT_MESSAGE } from "@/lib/safety/risk";
import {
  EXTRACT_SYSTEM_PROMPT,
  extractUserPrompt,
  REWRITE_SYSTEM_PROMPT,
  rewriteUserPrompt,
} from "./prompts";
import {
  type AiProvider,
  type CandidateAgreement,
  extractionResponseSchema,
  type RewriteOutcome,
  rewriteResponseSchema,
} from "./types";

/**
 * Amazon Bedrock via the `bedrock-mantle` endpoint, which speaks the
 * OpenAI-compatible Chat Completions API and authenticates with a single
 * Bedrock API key (no IAM signing).
 *
 * Two things are deliberate here:
 *
 *  - `store: false` on every request. Bedrock's Responses API retains inputs and
 *    outputs for 30 days by default; nothing in this product should sit in a
 *    third party's storage. For a hard guarantee the deployment also sets the
 *    account's data retention mode to `none` (see scripts/check-retention.ts).
 *
 *  - The model's output is never trusted. Rewrites must pass the
 *    fact-preservation guard and the risk screen before a user ever sees them.
 */

const REQUEST_TIMEOUT_MS = 20_000;

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

async function chat(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const config = env();
  const response = await fetch(`${config.BEDROCK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.BEDROCK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.BEDROCK_MODEL_ID,
      messages,
      max_tokens: maxTokens,
      temperature: 0,
      store: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    // The body can echo the request, so it is not logged.
    throw new Error(`bedrock_http_${response.status}`);
  }

  const payload: unknown = await response.json();
  const content = (payload as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("bedrock_empty_response");
  }
  return content.trim();
}

/**
 * Models wrap JSON in prose or fences often enough that a tolerant extractor is
 * worth more than a stricter prompt.
 */
export function parseJsonObject(raw: string): unknown {
  const withoutFences = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFences.slice(start, end + 1));
    }
    throw new Error("model_output_not_json");
  }
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function createMantleProvider(): AiProvider {
  const config = env();

  return {
    name: "bedrock-mantle",
    model: config.BEDROCK_MODEL_ID,

    async rewrite({ text, childNames }): Promise<RewriteOutcome> {
      const local = screenRisk(text);
      if (local.blockRewrite && local.level !== "ok") {
        return {
          status: "blocked_safety",
          level: local.level,
          message: SUPPORT_MESSAGE[local.level],
        };
      }

      let parsed;
      try {
        const raw = await chat(
          [
            { role: "system", content: REWRITE_SYSTEM_PROMPT },
            { role: "user", content: rewriteUserPrompt(text, childNames) },
          ],
          1200,
        );
        parsed = rewriteResponseSchema.parse(parseJsonObject(raw));
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown_error";
        return { status: "unavailable", reason };
      }

      const risk = mergeRisk(local.level, parsed.safety);
      if (risk !== "ok") {
        return {
          status: "blocked_safety",
          level: risk,
          message: SUPPORT_MESSAGE[risk],
        };
      }

      const suggestion = parsed.suggestion.trim();

      if (normaliseWhitespace(suggestion) === normaliseWhitespace(text)) {
        return { status: "unchanged", reason: "already_neutral" };
      }

      const facts = compareFacts(text, suggestion, childNames);
      if (!facts.ok) {
        return {
          status: "blocked_facts",
          missing: facts.missing,
          invented: facts.invented,
        };
      }

      return {
        status: "suggested",
        suggestion,
        whatChanged: parsed.what_changed,
        removedPhrases: parsed.removed_phrases,
      };
    },

    async extractAgreements(input): Promise<CandidateAgreement[]> {
      let parsed;
      try {
        const raw = await chat(
          [
            { role: "system", content: EXTRACT_SYSTEM_PROMPT },
            { role: "user", content: extractUserPrompt(input) },
          ],
          900,
        );
        parsed = extractionResponseSchema.parse(parseJsonObject(raw));
      } catch {
        // Extraction is an assist, never a blocker: on failure the message is
        // still recorded and the user can add an agreement by hand.
        return [];
      }

      return parsed.agreements
        .filter((agreement) => input.text.includes(agreement.source_quote.trim()))
        .map((agreement) => ({
          text: agreement.text.trim(),
          sourceQuote: agreement.source_quote.trim(),
          owner: agreement.owner,
          dueAt: agreement.due_iso ? parseDue(agreement.due_iso) : null,
        }))
        .filter((agreement) => agreement.text.length > 0);
    },
  };
}

function parseDue(value: string): Date | null {
  const iso = value.length === 10 ? `${value}T12:00:00Z` : `${value}:00Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
