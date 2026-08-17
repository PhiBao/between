import { createHash, randomBytes } from "node:crypto";

/**
 * Invite tokens.
 *
 * The raw token exists only in the link the inviting parent shares. The database
 * stores its SHA-256 hash, so a leaked database row cannot be turned back into
 * a working invite. Tokens are single use and expire.
 */

export const INVITE_TTL_HOURS = 72;

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000);
}
