"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Used only for sign-in, sign-up and sign-out, so that auth
 * cookies are written by Supabase itself. All application data access happens
 * on the server.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
