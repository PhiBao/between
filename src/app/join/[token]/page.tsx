import Link from "next/link";
import { redirect } from "next/navigation";
import { joinRecord } from "@/app/actions";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const user = await currentUser();

  if (!user) {
    redirect(`/sign-up?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Join this record</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        You have been invited to share a co-parenting record. Once you join, both
        of you see the same messages and the same agreements, in the same order.
        Neither of you can edit or delete what is already there.
      </p>

      <form action={joinRecord} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
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
            placeholder="Sam"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full">
          Join the record
        </button>
      </form>

      <p className="mt-6 text-xs text-[var(--color-muted)]">
        Invites are single use and expire after 72 hours.{" "}
        <Link className="underline" href="/">
          What is Between?
        </Link>
      </p>
    </main>
  );
}
