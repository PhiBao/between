import { describe, expect, it } from "vitest";
import { nextPathSchema } from "./redirects";

/**
 * A pre-submission audit found that `startsWith("/")` accepts "//evil.com",
 * which is a protocol-relative URL and therefore an open redirect hanging off a
 * sign-in link. These cases exist so that cannot come back.
 */
describe("nextPathSchema", () => {
  it("accepts ordinary in-app destinations", () => {
    for (const path of ["/record", "/agreements", "/join/abc-123", "/pack?from=2026-01-01"]) {
      expect(nextPathSchema.safeParse(path).success, path).toBe(true);
    }
  });

  it("rejects protocol-relative and absolute URLs", () => {
    for (const path of [
      "//evil.com",
      "///evil.com",
      "https://evil.com",
      "http://evil.com",
      "javascript:alert(1)",
      "record",
      "",
    ]) {
      expect(nextPathSchema.safeParse(path).success, path).toBe(false);
    }
  });

  it("rejects a destination long enough to be an attack payload", () => {
    expect(nextPathSchema.safeParse(`/${"a".repeat(400)}`).success).toBe(false);
  });
});
