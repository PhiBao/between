import { env } from "@/lib/env";
import { createMantleProvider } from "./mantle";
import { createMockProvider } from "./mock";
import type { AiProvider } from "./types";

let cached: AiProvider | null = null;

/**
 * Resolves the active provider once per process.
 *
 * `AI_PROVIDER=mantle` uses Amazon Bedrock; anything else uses the deterministic
 * offline provider so the app always runs, even with no credentials.
 */
export function aiProvider(): AiProvider {
  if (cached) return cached;
  cached = env().AI_PROVIDER === "mantle" ? createMantleProvider() : createMockProvider();
  return cached;
}

export function isOfflineProvider(): boolean {
  return aiProvider().name === "offline-demo";
}

export type { AiProvider, CandidateAgreement, RewriteOutcome } from "./types";
