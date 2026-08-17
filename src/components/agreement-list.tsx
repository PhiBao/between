"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToAgreement } from "@/app/actions";
import type { Agreement } from "@/lib/types";

/**
 * Agreements are shown as plain sentences with their provenance attached, not
 * as a table of records. Each card answers three questions: what was agreed,
 * where it came from, and who has to do something next.
 */
export function AgreementList({
  agreements,
  otherName,
}: {
  agreements: Agreement[];
  otherName: string | null;
}) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const open = agreements.filter(
    (agreement) => agreement.status === "proposed" || agreement.status === "confirmed",
  );
  const visible = filter === "open" ? open : agreements;

  async function respond(
    agreement: Agreement,
    action: "confirmed" | "declined" | "marked_done",
  ) {
    setBusyId(agreement.id);
    setError(null);
    const result = await respondToAgreement({ agreementId: agreement.id, action });
    setBusyId(null);
    if (!result.ok) setError(result.error ?? "That did not work.");
    else startTransition(() => router.refresh());
  }

  if (agreements.length === 0) {
    return (
      <div className="card p-6 text-center">
        <h2 className="font-semibold">No agreements yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-muted)]">
          When a message contains a commitment — a pickup time, a payment, a form
          to send — Between offers to track it. Tracked agreements show up here
          with the exact words they came from.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="no-print mb-3 flex gap-2"
        role="group"
        aria-label="Filter agreements"
      >
        <button
          type="button"
          aria-pressed={filter === "open"}
          className={`btn text-sm ${filter === "open" ? "btn-primary" : ""}`}
          onClick={() => setFilter("open")}
        >
          Needs attention ({open.length})
        </button>
        <button
          type="button"
          aria-pressed={filter === "all"}
          className={`btn text-sm ${filter === "all" ? "btn-primary" : ""}`}
          onClick={() => setFilter("all")}
        >
          Everything ({agreements.length})
        </button>
      </div>

      {error ? (
        <p role="alert" className="mb-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="card p-6 text-center text-sm text-[var(--color-muted)]">
          Nothing needs your attention right now.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((agreement) => (
            <li key={agreement.id}>
              <article className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-[0.98rem] font-semibold">{agreement.text}</h2>
                  <StatusChip agreement={agreement} />
                </div>

                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {ownerLabel(agreement, otherName)}
                  {agreement.dueAt ? ` · due ${formatDate(agreement.dueAt)}` : ""}
                </p>

                <p className="quote mt-3">“{agreement.sourceQuote}”</p>

                <ul className="mt-3 space-y-0.5 text-xs text-[var(--color-muted)]">
                  {agreement.events.map((event, index) => (
                    <li key={`${event.action}-${index}`}>
                      {eventLabel(event.action)} by {event.actorName} ·{" "}
                      {formatDate(event.createdAt)}
                      {event.detail ? ` · ${event.detail}` : ""}
                    </li>
                  ))}
                </ul>

                <div className="no-print mt-3 flex flex-wrap gap-2">
                  {agreement.awaitingMe ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary text-sm"
                        disabled={busyId === agreement.id}
                        onClick={() => respond(agreement, "confirmed")}
                      >
                        That is right
                      </button>
                      <button
                        type="button"
                        className="btn text-sm"
                        disabled={busyId === agreement.id}
                        onClick={() => respond(agreement, "declined")}
                      >
                        That is not what we agreed
                      </button>
                    </>
                  ) : null}

                  {(agreement.status === "confirmed" ||
                    (agreement.status === "proposed" && agreement.mine)) &&
                  !agreement.awaitingMe ? (
                    <button
                      type="button"
                      className="btn text-sm"
                      disabled={busyId === agreement.id}
                      onClick={() => respond(agreement, "marked_done")}
                    >
                      Mark as done
                    </button>
                  ) : null}

                  {agreement.status === "proposed" && agreement.mine ? (
                    <p className="text-xs text-[var(--color-muted)]">
                      Waiting on {otherName ?? "the other parent"} to confirm.
                    </p>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({ agreement }: { agreement: Agreement }) {
  const style =
    agreement.status === "confirmed" && !agreement.overdue
      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
      : agreement.overdue
        ? "bg-[var(--color-warn-soft)] text-[var(--color-warn)]"
        : agreement.status === "declined"
          ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
          : "bg-[#f1ede8] text-[var(--color-muted)]";

  const label =
    agreement.status === "proposed"
      ? "Unconfirmed"
      : agreement.status === "confirmed"
        ? agreement.overdue
          ? "Overdue"
          : "Confirmed"
        : agreement.status === "declined"
          ? "Declined"
          : agreement.status === "done"
            ? "Done"
            : "Missed";

  return <span className={`chip ${style}`}>{label}</span>;
}

function ownerLabel(agreement: Agreement, otherName: string | null): string {
  const other = otherName ?? "the other parent";
  if (agreement.owner === "both") return "Both parents";
  if (agreement.mine) return agreement.owner === "author" ? "You" : other;
  return agreement.owner === "author" ? other : "You";
}

function eventLabel(action: string): string {
  switch (action) {
    case "created":
      return "Tracked";
    case "confirmed":
      return "Confirmed";
    case "declined":
      return "Declined";
    case "marked_done":
      return "Marked done";
    case "due_changed":
      return "Due date changed";
    default:
      return action;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
