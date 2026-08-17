import { redirect } from "next/navigation";
import { createRecord } from "@/app/actions";
import { loadFamilyContext } from "@/lib/record/queries";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const context = await loadFamilyContext(user.id);
  if (context) redirect("/record");

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Set up your record</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Two questions, then you can write your first message. You can invite the
        other parent whenever you want — the record works without them.
      </p>

      <form action={createRecord} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="displayName">
            Your first name
          </label>
          <input
            id="displayName"
            name="displayName"
            className="field"
            required
            maxLength={60}
            autoComplete="given-name"
            placeholder="Alex"
          />
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            This is how you appear in the record.
          </p>
        </div>

        <fieldset>
          <legend className="label">Your children&apos;s first names</legend>
          <div className="space-y-2">
            <input
              name="children"
              className="field"
              maxLength={60}
              placeholder="Mia"
              aria-label="First child's name"
            />
            <input
              name="children"
              className="field"
              maxLength={60}
              placeholder="Another name (optional)"
              aria-label="Second child's name"
            />
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Used so a calmer version of a message can never quietly drop their
            name. Nothing else about them is stored.
          </p>
        </fieldset>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full">
          Create my record
        </button>
      </form>
    </main>
  );
}
