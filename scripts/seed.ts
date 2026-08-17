/**
 * Seeds the demo record that reviewers land in.
 *
 * Run with: pnpm seed
 *
 * Everything here is fictional. The two accounts are deliberately ordinary
 * ("alex" and "sam") and the history is the kind of exchange that actually
 * happens: a late handover, a school payment, a swap request, one message that
 * would have made things worse, and agreements in several different states.
 *
 * The script is idempotent: it deletes and recreates the demo family, so it can
 * be run again after a demo has been messed with.
 */

import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// --- env -------------------------------------------------------------------

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match?.[1] && process.env[match[1]] === undefined) {
    process.env[match[1]] = match[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO = {
  alex: { email: "alex@between.demo", password: "between-demo-2026", name: "Alex" },
  sam: { email: "sam@between.demo", password: "between-demo-2026", name: "Sam" },
};

const ZERO_HASH = "0".repeat(64);

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function canonicalTimestamp(date: Date): string {
  return date.toISOString().replace(/(\.\d{3})\d*Z$/, "$1Z");
}

function entryHash(input: {
  seq: number;
  familyId: string;
  kind: string;
  authorId: string;
  occurredAt: Date;
  body: string;
  prevHash: string;
}): string {
  return sha256(
    [
      String(input.seq),
      input.familyId,
      input.kind,
      input.authorId,
      canonicalTimestamp(input.occurredAt),
      sha256(input.body),
      input.prevHash,
    ].join("|"),
  );
}

async function ensureUser(
  client: SupabaseClient,
  account: { email: string; password: string },
): Promise<string> {
  const { data: list } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((user) => user.email === account.email);

  if (existing) {
    await client.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email_confirm: true,
    });
    return existing.id;
  }

  const { data, error } = await client.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`could not create ${account.email}: ${error?.message}`);
  }
  return data.user.id;
}

function daysAgo(days: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function inDays(days: number, hour: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

async function main(): Promise<void> {
  const alexId = await ensureUser(admin, DEMO.alex);
  const samId = await ensureUser(admin, DEMO.sam);

  // Remove any previous demo record so the script can be re-run.
  const { data: existing } = await admin
    .from("memberships")
    .select("family_id")
    .in("user_id", [alexId, samId]);

  const familyIds = [...new Set((existing ?? []).map((row) => row.family_id as string))];
  if (familyIds.length > 0) {
    await admin.from("families").delete().in("id", familyIds);
  }

  const familyId = randomUUID();
  await admin.from("families").insert({ id: familyId, label: "Alex and Sam" });

  await admin.from("memberships").insert([
    { family_id: familyId, user_id: alexId, display_name: DEMO.alex.name, status: "active" },
    { family_id: familyId, user_id: samId, display_name: DEMO.sam.name, status: "active" },
  ]);

  await admin.from("children").insert([
    { family_id: familyId, name: "Mia" },
    { family_id: familyId, name: "Theo" },
  ]);

  const script: {
    author: "alex" | "sam";
    kind: "sent" | "logged_external";
    body: string;
    at: Date;
    rewriteUsed?: boolean;
  }[] = [
    {
      author: "alex",
      kind: "sent",
      body: "Mia has a dentist appointment on the 12th at 9:30am. I can take her, but she will need to be at mine the night before.",
      at: daysAgo(21, 8, 12),
      rewriteUsed: false,
    },
    {
      author: "sam",
      kind: "sent",
      body: "That works. I will drop her at yours on the 11th by 7pm.",
      at: daysAgo(21, 12, 40),
    },
    {
      author: "alex",
      kind: "sent",
      body: "Thanks. The school trip money is due on the 20th, it is $75 for Theo. Can you send half?",
      at: daysAgo(14, 9, 5),
    },
    {
      author: "sam",
      kind: "logged_external",
      body: "Got it, I will transfer $37.50 before the 20th.",
      at: daysAgo(14, 18, 30),
    },
    {
      author: "alex",
      kind: "sent",
      body: "You were 40 minutes late on Friday the 21st and Mia was standing outside in the rain. Please send the $75 for the school trip. Pickup is 5pm on the 28th, please be on time.",
      at: daysAgo(6, 19, 15),
      rewriteUsed: true,
    },
    {
      author: "sam",
      kind: "sent",
      body: "I was stuck at work and my phone died. I will be there at 5pm on the 28th. Can we swap the weekend of the 5th, I have a wedding?",
      at: daysAgo(6, 20, 2),
    },
    {
      author: "alex",
      kind: "sent",
      body: "I can do the weekend of the 5th if you take the 12th instead. I will confirm with Theo about football.",
      at: daysAgo(5, 8, 45),
      rewriteUsed: true,
    },
  ];

  let prevHash = ZERO_HASH;
  const entryIds: Record<number, string> = {};

  for (const [index, item] of script.entries()) {
    const seq = index + 1;
    const authorId = item.author === "alex" ? alexId : samId;
    const authorName = item.author === "alex" ? DEMO.alex.name : DEMO.sam.name;
    const occurredAt = new Date(canonicalTimestamp(item.at));
    const hash = entryHash({
      seq,
      familyId,
      kind: item.kind,
      authorId,
      occurredAt,
      body: item.body,
      prevHash,
    });

    const { data, error } = await admin
      .from("entries")
      .insert({
        family_id: familyId,
        seq,
        kind: item.kind,
        author_id: authorId,
        author_name: authorName,
        body: item.body,
        occurred_at: occurredAt.toISOString(),
        rewrite_used: item.rewriteUsed ?? false,
        prev_hash: prevHash,
        hash,
      })
      .select("id")
      .single();

    if (error) throw new Error(`entry ${seq} failed: ${error.message}`);

    entryIds[seq] = data.id as string;
    prevHash = hash;
  }

  // Read receipts: both parents have caught up except the most recent message.
  const readRows = Object.entries(entryIds)
    .filter(([seq]) => Number(seq) < script.length)
    .map(([seq, id]) => {
      const authoredByAlex = script[Number(seq) - 1]!.author === "alex";
      return {
        entry_id: id,
        family_id: familyId,
        user_id: authoredByAlex ? samId : alexId,
        read_at: new Date().toISOString(),
      };
    });
  await admin.from("entry_reads").insert(readRows);

  // Agreements in four different states, each quoting the message it came from.
  const agreements = [
    {
      entrySeq: 2,
      text: "Sam drops Mia at Alex's on the 11th by 7pm",
      quote: "I will drop her at yours on the 11th by 7pm.",
      owner: "author",
      createdBy: samId,
      createdName: DEMO.sam.name,
      dueAt: daysAgo(10, 19),
      status: "done" as const,
      events: ["created", "confirmed", "marked_done"] as const,
    },
    {
      entrySeq: 4,
      text: "Sam transfers $37.50 for Theo's school trip before the 20th",
      quote: "I will transfer $37.50 before the 20th.",
      owner: "other",
      createdBy: alexId,
      createdName: DEMO.alex.name,
      dueAt: daysAgo(3, 12),
      status: "confirmed" as const,
      events: ["created", "confirmed"] as const,
    },
    {
      entrySeq: 6,
      text: "Sam collects the children at 5pm on the 28th",
      quote: "I will be there at 5pm on the 28th.",
      owner: "author",
      createdBy: samId,
      createdName: DEMO.sam.name,
      dueAt: inDays(4, 17),
      status: "confirmed" as const,
      events: ["created", "confirmed"] as const,
    },
    {
      entrySeq: 7,
      text: "Swap: Sam takes the weekend of the 12th in exchange for the 5th",
      quote: "I can do the weekend of the 5th if you take the 12th instead.",
      owner: "both",
      createdBy: alexId,
      createdName: DEMO.alex.name,
      dueAt: inDays(9, 12),
      status: "proposed" as const,
      events: ["created"] as const,
    },
  ];

  for (const item of agreements) {
    const { data, error } = await admin
      .from("agreements")
      .insert({
        family_id: familyId,
        entry_id: entryIds[item.entrySeq],
        text: item.text,
        source_quote: item.quote,
        owner: item.owner,
        due_at: item.dueAt.toISOString(),
        status: item.status,
        created_by: item.createdBy,
      })
      .select("id")
      .single();

    if (error) throw new Error(`agreement failed: ${error.message}`);

    const otherName =
      item.createdBy === alexId ? DEMO.sam.name : DEMO.alex.name;

    await admin.from("agreement_events").insert(
      item.events.map((action, index) => ({
        agreement_id: data.id as string,
        family_id: familyId,
        actor_id: action === "created" ? item.createdBy : null,
        actor_name: action === "created" ? item.createdName : otherName,
        action,
        created_at: daysAgo(20 - index * 2, 10).toISOString(),
      })),
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    [
      "Seeded the demo record.",
      "",
      `  ${DEMO.alex.email} / ${DEMO.alex.password}`,
      `  ${DEMO.sam.email} / ${DEMO.sam.password}`,
      "",
      `  ${script.length} messages, ${agreements.length} agreements`,
      `  head hash: ${prevHash}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
