import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it is confined to two callers:
 *   - the seed script (creating the demo record)
 *   - the scheduled job (reading due dates across families)
 *
 * It must never be used to serve a signed-in user's request; that is what
 * `supabaseServer()` is for.
 */
export function supabaseAdmin() {
  const config = env();
  if (!config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
  }

  return createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
