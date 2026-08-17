import Link from "next/link";
import { redirect } from "next/navigation";
import { loadFamilyContext } from "@/lib/record/queries";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (user) {
    const context = await loadFamilyContext(user.id);
    redirect(context ? "/record" : "/start");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-12">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)]">
        BETWEEN
      </p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
        The neutral record between two homes.
      </h1>

      <div className="prose-tight mt-5 text-[1.02rem] text-[var(--color-muted)]">
        <p>
          Co-parenting after a separation means every message can become
          evidence, and every agreement can become an argument about what was
          agreed.
        </p>
        <p>
          Between does three things. It offers a calmer version of the message you
          are about to send, keeping every date, time and amount exactly as you
          wrote them. It reads the commitments out of what you send and tracks
          whether the other parent confirmed them. And it turns the whole record
          into a dated pack you can hand to a solicitor or a mediator.
        </p>
      </div>

      <ul className="mt-6 space-y-2 text-sm">
        <li className="card p-3">
          <strong>It never speaks for you.</strong> You see one suggestion and
          choose. Sending your own words is always one tap away.
        </li>
        <li className="card p-3">
          <strong>Drafts are never stored.</strong> Only what you actually send
          becomes part of the record.
        </li>
        <li className="card p-3">
          <strong>The record cannot be quietly edited.</strong> Every entry is
          sealed to the one before it, and exports carry a hash you can check.
        </li>
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="btn btn-primary" href="/sign-up">
          Start a record
        </Link>
        <Link className="btn" href="/sign-in">
          Sign in
        </Link>
      </div>

      <p className="mt-8 text-xs text-[var(--color-muted)]">
        Between is a record-keeping and communication tool. It does not give legal
        advice, and it does not decide anything about your children.
      </p>
    </main>
  );
}
