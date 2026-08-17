import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * A Supabase client bound to the signed-in user's session.
 *
 * Every read and write in the app goes through this client, which means Row
 * Level Security is the real authorization boundary. The service-role key is
 * never used to serve a user request — only by scripts and the scheduled job.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  const config = env();

  return createServerClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies are
            // read-only. Session refresh happens in middleware instead.
          }
        },
      },
    },
  );
}

export async function currentUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
