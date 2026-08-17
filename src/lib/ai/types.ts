import { z } from "zod";

/** What the model is asked to return when softening a message. */
export const rewriteResponseSchema = z.object({
  suggestion: z.string().min(1).max(4000),
  what_changed: z.array(z.string().min(1).max(160)).max(6).default([]),
  removed_phrases: z.array(z.string().min(1).max(160)).max(10).default([]),
  safety: z.enum(["ok", "threat", "self_harm"]).default("ok"),
});

export type RewriteResponse = z.infer<typeof rewriteResponseSchema>;

/** What the model is asked to return when reading commitments out of a message. */
export const extractionResponseSchema = z.object({
  agreements: z
    .array(
      z.object({
        text: z.string().min(3).max(400),
        source_quote: z.string().min(3).max(1000),
        owner: z.enum(["author", "other", "both"]),
        due_iso: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/)
          .nullable()
          .default(null),
      }),
    )
    .max(5)
    .default([]),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

/** A commitment that survived validation and can be offered to the user. */
export interface CandidateAgreement {
  text: string;
  sourceQuote: string;
  owner: "author" | "other" | "both";
  dueAt: Date | null;
}

export type RewriteOutcome =
  | {
      status: "suggested";
      suggestion: string;
      whatChanged: string[];
      removedPhrases: string[];
    }
  | { status: "unchanged"; reason: "already_neutral" }
  | { status: "blocked_facts"; missing: string[]; invented: string[] }
  | { status: "blocked_safety"; level: "threat" | "self_harm"; message: string }
  | { status: "unavailable"; reason: string };

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  rewrite(input: {
    text: string;
    childNames: readonly string[];
  }): Promise<RewriteOutcome>;
  extractAgreements(input: {
    text: string;
    authorName: string;
    otherName: string;
    now: Date;
  }): Promise<CandidateAgreement[]>;
}
