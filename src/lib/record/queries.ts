import { supabaseServer } from "@/lib/supabase/server";
import type {
  Agreement,
  AgreementEvent,
  AgreementOwner,
  AgreementStatus,
  EntryKind,
  FamilyContext,
  RecordEntry,
} from "@/lib/types";

/**
 * Read side of the record. Everything here runs through the user's session, so
 * RLS decides what is visible; these functions only shape the result for the UI.
 */

interface MembershipRow {
  id: string;
  family_id: string;
  user_id: string;
  display_name: string;
}

export async function loadFamilyContext(
  userId: string,
): Promise<FamilyContext | null> {
  const supabase = await supabaseServer();

  const { data: mine } = await supabase
    .from("memberships")
    .select("id, family_id, user_id, display_name")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<MembershipRow>();

  if (!mine) return null;

  const [{ data: members }, { data: children }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, family_id, user_id, display_name")
      .eq("family_id", mine.family_id)
      .eq("status", "active"),
    supabase
      .from("children")
      .select("name")
      .eq("family_id", mine.family_id)
      .order("created_at", { ascending: true }),
  ]);

  const other =
    (members ?? []).find((member: MembershipRow) => member.user_id !== userId) ?? null;

  return {
    familyId: mine.family_id,
    me: {
      id: mine.id,
      familyId: mine.family_id,
      userId: mine.user_id,
      displayName: mine.display_name,
    },
    other: other
      ? {
          id: other.id,
          familyId: other.family_id,
          userId: other.user_id,
          displayName: other.display_name,
        }
      : null,
    childNames: (children ?? []).map((child: { name: string }) => child.name),
  };
}

interface EntryRow {
  id: string;
  seq: number;
  kind: EntryKind;
  author_id: string;
  author_name: string;
  body: string;
  occurred_at: string;
  created_at: string;
  hash: string;
  prev_hash: string;
  rewrite_used: boolean;
}

export async function loadEntries(
  familyId: string,
  userId: string,
): Promise<RecordEntry[]> {
  const supabase = await supabaseServer();

  const [{ data: rows }, { data: reads }] = await Promise.all([
    supabase
      .from("entries")
      .select(
        "id, seq, kind, author_id, author_name, body, occurred_at, created_at, hash, prev_hash, rewrite_used",
      )
      .eq("family_id", familyId)
      .order("seq", { ascending: true }),
    supabase
      .from("entry_reads")
      .select("entry_id, user_id")
      .eq("family_id", familyId),
  ]);

  const readByOthers = new Set(
    (reads ?? [])
      .filter((read: { user_id: string }) => read.user_id !== userId)
      .map((read: { entry_id: string }) => read.entry_id),
  );

  return (rows ?? []).map((row: EntryRow) => ({
    id: row.id,
    seq: row.seq,
    kind: row.kind,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    hash: row.hash,
    prevHash: row.prev_hash,
    rewriteUsed: row.rewrite_used,
    readByOther: readByOthers.has(row.id),
    mine: row.author_id === userId,
  }));
}

interface AgreementRow {
  id: string;
  entry_id: string;
  text: string;
  source_quote: string;
  owner: AgreementOwner;
  due_at: string | null;
  status: AgreementStatus;
  created_by: string;
  created_at: string;
}

interface AgreementEventRow {
  agreement_id: string;
  action: string;
  actor_name: string;
  detail: string | null;
  created_at: string;
}

export async function loadAgreements(
  familyId: string,
  userId: string,
): Promise<Agreement[]> {
  const supabase = await supabaseServer();

  const [{ data: rows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("agreements")
      .select(
        "id, entry_id, text, source_quote, owner, due_at, status, created_by, created_at",
      )
      .eq("family_id", familyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("agreement_events")
      .select("agreement_id, action, actor_name, detail, created_at")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true }),
  ]);

  const eventsByAgreement = new Map<string, AgreementEvent[]>();
  for (const event of (eventRows ?? []) as AgreementEventRow[]) {
    const list = eventsByAgreement.get(event.agreement_id) ?? [];
    list.push({
      action: event.action,
      actorName: event.actor_name,
      detail: event.detail,
      createdAt: event.created_at,
    });
    eventsByAgreement.set(event.agreement_id, list);
  }

  const now = Date.now();

  return ((rows ?? []) as AgreementRow[]).map((row) => ({
    id: row.id,
    entryId: row.entry_id,
    text: row.text,
    sourceQuote: row.source_quote,
    owner: row.owner,
    dueAt: row.due_at,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    mine: row.created_by === userId,
    awaitingMe: row.status === "proposed" && row.created_by !== userId,
    overdue:
      row.due_at !== null &&
      new Date(row.due_at).getTime() < now &&
      row.status !== "done" &&
      row.status !== "declined",
    events: eventsByAgreement.get(row.id) ?? [],
  }));
}

/** Records that the signed-in user has seen the other parent's messages. */
export async function markOtherEntriesRead(
  familyId: string,
  userId: string,
): Promise<void> {
  const supabase = await supabaseServer();

  const { data: unread } = await supabase
    .from("entries")
    .select("id")
    .eq("family_id", familyId)
    .eq("kind", "sent")
    .neq("author_id", userId)
    .limit(200);

  if (!unread || unread.length === 0) return;

  await supabase.from("entry_reads").upsert(
    unread.map((entry: { id: string }) => ({
      entry_id: entry.id,
      family_id: familyId,
      user_id: userId,
    })),
    { onConflict: "entry_id,user_id", ignoreDuplicates: true },
  );
}
