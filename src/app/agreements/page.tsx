import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AgreementList } from "@/components/agreement-list";
import { loadAgreements, loadFamilyContext } from "@/lib/record/queries";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AgreementsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const context = await loadFamilyContext(user.id);
  if (!context) redirect("/start");

  const agreements = await loadAgreements(context.familyId, user.id);

  return (
    <AppShell
      active="/agreements"
      title="Agreements"
      subtitle="What was actually agreed, and who still owes an answer"
    >
      <AgreementList
        agreements={agreements}
        otherName={context.other?.displayName ?? null}
      />
    </AppShell>
  );
}
