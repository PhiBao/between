import type { Agreement, RecordEntry } from "@/lib/types";

/**
 * The record itself: one chronological thread, with the agreements that came
 * out of a message shown underneath it. Sequence numbers are visible because
 * the record's value is that nothing can quietly disappear from it.
 */
export function RecordTimeline({
  entries,
  agreements,
}: {
  entries: RecordEntry[];
  agreements: Agreement[];
}) {
  if (entries.length === 0) {
    return (
      <div className="card mt-4 p-6 text-center">
        <h2 className="font-semibold">Nothing recorded yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-muted)]">
          Write your next message above, or log one you were sent elsewhere. From
          then on, every message and every agreement is kept in order and can be
          exported.
        </p>
      </div>
    );
  }

  const byEntry = new Map<string, Agreement[]>();
  for (const agreement of agreements) {
    const list = byEntry.get(agreement.entryId) ?? [];
    list.push(agreement);
    byEntry.set(agreement.entryId, list);
  }

  return (
    <ol className="mt-4 space-y-3">
      {entries.map((entry) => (
        <li key={entry.id}>
          <article
            className={`card p-3 ${
              entry.mine && entry.kind === "sent"
                ? "bg-[var(--color-accent-soft)]"
                : ""
            }`}
          >
            <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-ink)]">
                {entry.kind === "logged_external"
                  ? `Logged by ${entry.authorName}`
                  : entry.authorName}
              </span>
              <span>#{entry.seq}</span>
              <time dateTime={entry.occurredAt}>{formatWhen(entry.occurredAt)}</time>
              {entry.kind === "sent" && entry.mine ? (
                <span>{entry.readByOther ? "Read" : "Delivered"}</span>
              ) : null}
              {entry.rewriteUsed ? <span>Sent as suggested</span> : null}
            </header>

            {entry.kind === "logged_external" ? (
              <p className="mt-2 text-xs text-[var(--color-warn)]">
                Logged from outside Between — recorded by {entry.authorName}, not
                delivered through this app.
              </p>
            ) : null}

            <p className="mt-2 whitespace-pre-wrap text-[0.95rem]">{entry.body}</p>

            {(byEntry.get(entry.id) ?? []).map((agreement) => (
              <p
                key={agreement.id}
                className="mt-2 border-t border-[var(--color-line)] pt-2 text-xs text-[var(--color-muted)]"
              >
                Agreement: {agreement.text} — {statusLabel(agreement)}
              </p>
            ))}
          </article>
        </li>
      ))}
    </ol>
  );
}

export function formatWhen(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function statusLabel(agreement: Agreement): string {
  switch (agreement.status) {
    case "proposed":
      return "waiting to be confirmed";
    case "confirmed":
      return agreement.overdue ? "confirmed, now overdue" : "confirmed";
    case "declined":
      return "declined";
    case "done":
      return "done";
    case "missed":
      return "missed";
    default:
      return agreement.status;
  }
}
