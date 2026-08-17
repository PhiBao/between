"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { nextPathSchema } from "@/lib/redirects";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Authentication runs server-side.
 *
 * Signing in from the browser works, but the session cookie is then written by
 * client JavaScript, which races the navigation that follows it. Doing it in a
 * server action means the cookie arrives on the same response as the redirect,
 * so the very next request is already authenticated.
 */

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Passwords are at least 8 characters."),
  next: nextPathSchema.optional(),
});

function backTo(mode: "sign-in" | "sign-up", message: string, next?: string): never {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", next);
  redirect(`/${mode}?${params.toString()}`);
}

export async function signIn(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    backTo("sign-in", parsed.error.issues[0]?.message ?? "Check your details.");
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    backTo("sign-in", "That email and password do not match.", parsed.data.next);
  }

  redirect(parsed.data.next ?? "/record");
}

export async function signUp(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    backTo("sign-up", parsed.error.issues[0]?.message ?? "Check your details.");
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    backTo("sign-up", error.message, parsed.data.next);
  }

  if (!data.session) {
    backTo(
      "sign-in",
      "Your account was created. Confirm your email address, then sign in.",
      parsed.data.next,
    );
  }

  redirect(parsed.data.next ?? "/start");
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
