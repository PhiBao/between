import { z } from "zod";

/**
 * Where a sign-in may send someone afterwards.
 *
 * Must be a path inside this application. A single leading slash only —
 * "//evil.com" is a protocol-relative URL, and accepting it would turn every
 * sign-in link into an open redirect.
 */
export const nextPathSchema = z
  .string()
  .regex(/^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/, "Invalid destination.")
  .max(200);
