import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buildPack } from "@/lib/pack/build";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PackPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const pack = await buildPack({ userId: user.id });
  if (!pack) redirect("/start");

  const unconfirmed = pack.agreements.filter(
    (agreement) => agreement.status === "proposed",
  ).length;
  const overdue = pack.agreements.filter((agreement) => agreement.overdue).length;

  return (
    <AppShell
      active="/pack"
      title="Evidence pack"
      subtitle="Your record as a dated document you can hand to someone else"
    >
      <section className="card p-4">
        <h2 className="font-semibold">What is in the pack</h2>
        <ul className="mt-2 space-y-1 text-sm text-[var(--color-muted)]">
          <li>
            {pack.entries.length} message{pack.entries.length === 1 ? "" : "s"}, quoted
            in full and in order
          </li>
          <li>
            {pack.agreements.length} agreement
            {pack.agreements.length === 1 ? "" : "s"} with their full history
            {unconfirmed > 0 ? `, of which ${unconfirmed} unconfirmed` : ""}
            {overdue > 0 ? `, ${overdue} overdue` : ""}
          </li>
          <li>
            {pack.integrity.ok
              ? "An integrity check showing the record has not been altered"
              : "A warning that this record does not currently verify"}
          </li>
        </ul>

        {pack.entries.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            There is nothing to export yet. Send or log a message first.
          </p>
        ) : (
          <a className="btn btn-primary mt-4" href="/pack/download" download>
            Download the pack (PDF)
          </a>
        )}

        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Free, always, and it includes everything — a record you have to pay to
          read is not a record.
        </p>
      </section>

      <section className="card mt-4 p-4">
        <h2 className="font-semibold">Integrity</h2>
        {pack.integrity.ok ? (
          <>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Every message is sealed to the one before it. The pack carries this
              head hash, and anyone can re-check it on the verify page.
            </p>
            <p className="mt-2 break-all font-mono text-xs">
              {pack.integrity.headHash}
            </p>
            <a className="btn mt-3 text-sm" href="/verify">
              Open the verify page
            </a>
          </>
        ) : (
          <p className="mt-1 text-sm text-[var(--color-danger)]">
            This record does not verify: {pack.integrity.reason} (at message #
            {pack.integrity.brokenAtSeq}).
          </p>
        )}
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          This shows that the record has not been altered since it was written. It
          is not legal advice, and it does not prove who typed a message.
        </p>
      </section>
    </AppShell>
  );
}
