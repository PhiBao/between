/**
 * A deliberately conservative screen for messages where softening the wording
 * would be the wrong thing to do.
 *
 * This is NOT detection and it is not a safety guarantee. It is a cheap local
 * check that runs before and alongside the model's own verdict; if either flags
 * something, Between stops offering to rewrite and shows support resources
 * instead. The user can still send their own words — the product never blocks
 * a person from communicating.
 */

export type RiskLevel = "ok" | "threat" | "self_harm";

const SELF_HARM_PATTERNS: readonly RegExp[] = [
  /\bkill (?:myself|me)\b/i,
  /\bend (?:my life|it all)\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\b(?:hurt|harm|cut) myself\b/i,
  /\bdon'?t want to (?:be here|live)\b/i,
  /\bbetter off (?:dead|without me)\b/i,
];

const THREAT_PATTERNS: readonly RegExp[] = [
  /\b(?:i(?:'| a)?m going to|i will|i'?ll|gonna)\s+(?:kill|hurt|harm|destroy|beat|find)\s+you\b/i,
  /\byou'?re (?:dead|finished)\b/i,
  /\bwatch your back\b/i,
  /\bi know where you (?:live|work)\b/i,
  /\b(?:i'?ll|i will) take (?:the kids|her|him|them) and (?:you'?ll never|never)\b/i,
  /\bif you .{0,40}\b(?:i'?ll|i will) (?:make you|ruin|end)\b/i,
  /\b(?:i'?ll|i will) make you (?:regret|pay|sorry)\b/i,
];

export interface RiskVerdict {
  level: RiskLevel;
  /** True when the text should not be offered a softened rewrite. */
  blockRewrite: boolean;
}

export function screenRisk(text: string): RiskVerdict {
  for (const pattern of SELF_HARM_PATTERNS) {
    if (pattern.test(text)) return { level: "self_harm", blockRewrite: true };
  }
  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(text)) return { level: "threat", blockRewrite: true };
  }
  return { level: "ok", blockRewrite: false };
}

/** Merges the local screen with whatever the model reported. */
export function mergeRisk(local: RiskLevel, model: RiskLevel): RiskLevel {
  if (local === "self_harm" || model === "self_harm") return "self_harm";
  if (local === "threat" || model === "threat") return "threat";
  return "ok";
}

export const SUPPORT_MESSAGE: Record<Exclude<RiskLevel, "ok">, string> = {
  self_harm:
    "This message mentions harm to yourself. Between will not rewrite it. If you are in crisis, please talk to someone now — in the US call or text 988, in the UK call 116 123 (Samaritans), or contact your local emergency number.",
  threat:
    "This message reads as a threat. Between will not soften it, because a softened threat is still a threat and the record keeps what you send. If you or your children are in danger, contact your local emergency number or a domestic abuse service.",
};
