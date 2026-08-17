import { z } from "zod";

/**
 * Environment access is centralised and validated so a missing variable fails
 * loudly at the edge of the system instead of surfacing as a confusing runtime
 * error deep inside a request.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

  /** `mantle` calls Amazon Bedrock; `mock` is deterministic and offline. */
  AI_PROVIDER: z.enum(["mantle", "mock"]).default("mock"),
  BEDROCK_BASE_URL: z.string().url().optional(),
  BEDROCK_API_KEY: z.string().min(10).optional(),
  BEDROCK_MODEL_ID: z.string().min(3).default("openai.gpt-oss-120b"),

  CRON_SECRET: z.string().min(16).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AI_PROVIDER: process.env.AI_PROVIDER,
    BEDROCK_BASE_URL: process.env.BEDROCK_BASE_URL,
    BEDROCK_API_KEY: process.env.BEDROCK_API_KEY,
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
    CRON_SECRET: process.env.CRON_SECRET,
    APP_URL: process.env.APP_URL,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Invalid environment configuration (${missing}). Copy .env.example to .env.local and fill it in.`,
    );
  }

  // Fail fast rather than silently degrading to the mock provider in production.
  if (
    parsed.data.AI_PROVIDER === "mantle" &&
    (!parsed.data.BEDROCK_API_KEY || !parsed.data.BEDROCK_BASE_URL)
  ) {
    throw new Error(
      "AI_PROVIDER=mantle requires BEDROCK_API_KEY and BEDROCK_BASE_URL.",
    );
  }

  cached = parsed.data;
  return cached;
}

/** Used by tests to reset the memoised value. */
export function resetEnvCache(): void {
  cached = null;
}
