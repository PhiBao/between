"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiProvider } from "@/lib/ai";
import type { CandidateAgreement, RewriteOutcome } from "@/lib/ai/types";
import { env } from "@/lib/env";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
} from "@/lib/invites";
import { appendEntry } from "@/lib/record/append";
import { loadFamilyContext, markOtherEntriesRead } from "@/lib/record/queries";
import { supabaseServer } from "@/lib/supabase/server";
import type { FamilyContext } from "@/lib/types";

/**
 * Every action re-establishes who the caller is and which record they belong to.
 * Nothing is taken from the client except the payload, and the payload is
 * validated before it reaches the database.
 */
async function requireContext(): Promise<{ userId: string; context: FamilyContext }> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const context = await loadFamilyContext(user.id);
  if (!context) redirect("/start");

  return { userId: user.id, context };
}

/** Counters only — never message text. */
async function recordAiEvent(input: {
  familyId: string | null;
  userId: string;
  kind: "rewrite" | "extract";
  outcome:
    | "shown"
    | "accepted"
    | "sent_as_written"
    | "blocked_facts"
    | "blocked_safety"
    | "error";
  latencyMs?: number;
  inputChars?: number;
}): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.from("ai_events").insert({
    family_id: input.familyId,
    user_id: input.userId,
    kind: input.kind,
    outcome: input.outcome,
    model: aiProvider().model,
    latency_ms: input.latencyMs ?? null,
    input_chars: input.inputChars ?? null,
  });
}

// ------------------------------------------------------------- onboarding ----

const createRecordSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  children: z.array(z.string().trim().max(60)).max(6),
});

export async function createRecord(formData: FormData): Promise<void> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const parsed = createRecordSchema.safeParse({
    displayName: formData.get("displayName"),
    children: formData
      .getAll("children")
      .map((value) => String(value))
      .filter((value) => value.trim().length > 0),
  });

  if (!parsed.success) {
    redirect("/start?error=Please+enter+your+name");
  }

  const { error } = await supabase.rpc("create_family", {
    p_display_name: parsed.data.displayName,
    p_children: parsed.data.children,
  });

  if (error) redirect(`/start?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/record");
  redirect("/record");
}

// ---------------------------------------------------------------- rewrite ----

const textSchema = z.string().trim().min(1).max(4000);

export async function requestRewrite(text: string): Promise<RewriteOutcome> {
  const { userId, context } = await requireContext();

  const parsed = textSchema.safeParse(text);
  if (!parsed.success) {
    return { status: "unavailable", reason: "message_too_long_or_empty" };
  }

  const started = Date.now();
  const outcome = await aiProvider().rewrite({
    text: parsed.data,
    childNames: context.childNames,
  });

  const outcomeToCounter = {
    suggested: "shown",
    unchanged: "shown",
    blocked_facts: "blocked_facts",
    blocked_safety: "blocked_safety",
    unavailable: "error",
  } as const;

  await recordAiEvent({
    familyId: context.familyId,
    userId,
    kind: "rewrite",
    outcome: outcomeToCounter[outcome.status],
    latencyMs: Date.now() - started,
    inputChars: parsed.data.length,
  });

  return outcome;
}

// ------------------------------------------------------------------- send ----

const sendSchema = z.object({
  body: textSchema,
  usedSuggestion: z.boolean(),
});

export interface SendResult {
  entryId: string;
  candidates: CandidateAgreement[];
}

export async function sendMessage(input: {
  body: string;
  usedSuggestion: boolean;
}): Promise<SendResult> {
  const { userId, context } = await requireContext();
  const parsed = sendSchema.parse(input);

  const supabase = await supabaseServer();

  const entry = await appendEntry(supabase, {
    familyId: context.familyId,
    kind: "sent",
    authorId: userId,
    authorName: context.me.displayName,
    body: parsed.body,
    occurredAt: new Date(),
    rewriteUsed: parsed.usedSuggestion,
  });

  await recordAiEvent({
    familyId: context.familyId,
    userId,
    kind: "rewrite",
    outcome: parsed.usedSuggestion ? "accepted" : "sent_as_written",
    inputChars: parsed.body.length,
  });

  // Commitments are offered, never saved automatically: the user decides what
  // becomes part of the record's agreements.
  const candidates = await aiProvider().extractAgreements({
    text: parsed.body,
    authorName: context.me.displayName,
    otherName: context.other?.displayName ?? "the other parent",
    now: new Date(),
  });

  revalidatePath("/record");
  revalidatePath("/agreements");

  return { entryId: entry.id, candidates };
}

const logSchema = z.object({
  body: textSchema,
  occurredAt: z.string().datetime().optional(),
});

export async function logExternalMessage(input: {
  body: string;
  occurredAt?: string;
}): Promise<SendResult> {
  const { userId, context } = await requireContext();
  const parsed = logSchema.parse(input);

  const supabase = await supabaseServer();
  const occurredAt = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();

  const entry = await appendEntry(supabase, {
    familyId: context.familyId,
    kind: "logged_external",
    authorId: userId,
    authorName: context.me.displayName,
    body: parsed.body,
    occurredAt: occurredAt > new Date() ? new Date() : occurredAt,
    rewriteUsed: false,
  });

  const candidates = await aiProvider().extractAgreements({
    text: parsed.body,
    authorName: context.other?.displayName ?? "the other parent",
    otherName: context.me.displayName,
    now: new Date(),
  });

  revalidatePath("/record");
  revalidatePath("/agreements");

  return { entryId: entry.id, candidates };
}

// ------------------------------------------------------------- agreements ----

const trackSchema = z.object({
  entryId: z.string().uuid(),
  text: z.string().trim().min(3).max(400),
  sourceQuote: z.string().trim().min(3).max(1000),
  owner: z.enum(["author", "other", "both"]),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function trackAgreement(input: {
  entryId: string;
  text: string;
  sourceQuote: string;
  owner: "author" | "other" | "both";
  dueAt?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  await requireContext();
  const parsed = trackSchema.parse(input);

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("create_agreement", {
    p_entry_id: parsed.entryId,
    p_text: parsed.text,
    p_source_quote: parsed.sourceQuote,
    p_owner: parsed.owner,
    p_due_at: parsed.dueAt ?? null,
  });

  revalidatePath("/record");
  revalidatePath("/agreements");

  return error ? { ok: false, error: error.message } : { ok: true };
}

const respondSchema = z.object({
  agreementId: z.string().uuid(),
  action: z.enum(["confirmed", "declined", "marked_done", "due_changed"]),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function respondToAgreement(input: {
  agreementId: string;
  action: "confirmed" | "declined" | "marked_done" | "due_changed";
  dueAt?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  await requireContext();
  const parsed = respondSchema.parse(input);

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("set_agreement_status", {
    p_agreement_id: parsed.agreementId,
    p_action: parsed.action,
    p_due_at: parsed.dueAt ?? null,
  });

  revalidatePath("/record");
  revalidatePath("/agreements");

  return error ? { ok: false, error: error.message } : { ok: true };
}

// --------------------------------------------------------------- read acks ----

/**
 * Records that the signed-in parent has seen the other parent's messages.
 * "Read" is a fact in the record, so it is stored as its own immutable row
 * rather than by mutating the message.
 */
export async function markRead(): Promise<void> {
  const { userId, context } = await requireContext();
  await markOtherEntriesRead(context.familyId, userId);
}

// ---------------------------------------------------------------- invites ----


export async function createInvite(): Promise<{ url: string } | { error: string }> {
  const { userId, context } = await requireContext();

  if (context.other) {
    return { error: "This record already has two parents." };
  }

  const { token, tokenHash } = generateInviteToken();
  const supabase = await supabaseServer();

  const { error } = await supabase.from("invites").insert({
    family_id: context.familyId,
    token_hash: tokenHash,
    created_by: userId,
    expires_at: inviteExpiry().toISOString(),
  });

  if (error) return { error: error.message };

  return { url: `${env().APP_URL}/join/${token}` };
}

const joinSchema = z.object({
  token: z.string().min(10).max(200),
  displayName: z.string().trim().min(1).max(60),
});

export async function joinRecord(formData: FormData): Promise<void> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rawToken = String(formData.get("token") ?? "");
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/join/${rawToken}`)}`);

  const parsed = joinSchema.safeParse({
    token: rawToken,
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    redirect(`/join/${rawToken}?error=Please+enter+your+name`);
  }

  const { error } = await supabase.rpc("accept_invite", {
    p_token_hash: hashInviteToken(parsed.data.token),
    p_display_name: parsed.data.displayName,
  });

  if (error) {
    redirect(`/join/${parsed.data.token}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/record");
  redirect("/record");
}
