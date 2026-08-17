import Link from "next/link";
import { verifyPackHash } from "@/app/verify/actions";
import { VerifyForm } from "@/components/verify-form";

export const dynamic = "force-dynamic";

/**
 * A reader of an evidence pack should not have to trust the person who handed it
 * to them, or us. This page takes the head hash printed on a pack and says
 * whether a record with that head exists and still verifies.
 *
 * It reveals nothing else — no names, no messages, no dates beyond when the pack
 * was produced.
 */
export default function VerifyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 py-12">
      <Link href="/" className="text-sm font-semibold text-[var(--color-accent)]">
        BETWEEN
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Check an evidence pack</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Every pack produced by Between prints a head hash. Paste it here to check
        that it matches a record in this system and that the record has not been
        altered since the pack was produced.
      </p>

      <VerifyForm action={verifyPackHash} />

      <p className="mt-8 text-xs text-[var(--color-muted)]">
        This check tells you whether the record is unaltered. It does not tell you
        who wrote a message, and it is not legal advice.
      </p>
    </main>
  );
}
