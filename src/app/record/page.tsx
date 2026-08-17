import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Composer } from "@/components/composer";
import { MarkRead } from "@/components/mark-read";
import { RecordTimeline } from "@/components/record-timeline";
import { InviteCard, LogExternalForm } from "@/components/record-side";
import { isOfflineProvider } from "@/lib/ai";
import { loadAgreements, loadEntries, loadFamilyContext } from "@/lib/record/queries";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RecordPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const context = await loadFamilyContext(user.id);
  if (!context) redirect("/start");

  const [entries, agreements] = await Promise.all([
    loadEntries(context.familyId, user.id),
    loadAgreements(context.familyId, user.id),
  ]);

  const waiting = agreements.filter((agreement) => agreement.awaitingMe).length;

  return (
    <AppShell
      active="/record"
      title="Your record"
      subtitle={
        context.other
          ? `Shared with ${context.other.displayName}${
              context.childNames.length > 0 ? ` · ${context.childNames.join(", ")}` : ""
            }`
          : "Private to you until the other parent joins"
      }
    >
      <MarkRead />

      {waiting > 0 ? (
        <p className="no-print card mb-4 bg-[var(--color-warn-soft)] p-3 text-sm text-[var(--color-warn)]">
          {waiting === 1
            ? "1 agreement is waiting for your answer."
            : `${waiting} agreements are waiting for your answer.`}{" "}
          <a className="underline" href="/agreements">
            Open agreements
          </a>
        </p>
      ) : null}

      <Composer
        otherName={context.other?.displayName ?? null}
        offlineMode={isOfflineProvider()}
      />

      <LogExternalForm />
      <InviteCard hasOther={context.other !== null} />

      <RecordTimeline entries={entries} agreements={agreements} />
    </AppShell>
  );
}
