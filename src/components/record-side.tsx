"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInvite, logExternalMessage } from "@/app/actions";

/**
 * Between has to be useful before the other parent agrees to anything, because
 * in most separations they will not join on day one. So the invite is an offer,
 * not a requirement, and logging a message you were sent elsewhere is a
 * first-class way to build the record alone.
 */
export function InviteCard({ hasOther }: { hasOther: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (hasOther) return null;

  return (
    <section className="no-print card mt-4 p-4" aria-label="Invite the other parent">
      <h2 className="font-semibold">You are keeping this record on your own</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        That already works: your messages, your agreements, your export. If the
        other parent joins, messages are delivered here and they can confirm or
        decline what was agreed — which is what makes the record hard to argue
        with.
      </p>

      {url === null ? (
        <button
          type="button"
          className="btn mt-3"
          onClick={async () => {
            setError(null);
            const result = await createInvite();
            if ("url" in result) setUrl(result.url);
            else setError(result.error);
          }}
        >
          Create an invite link
        </button>
      ) : (
        <div className="mt-3">
          <label className="label" htmlFor="invite-url">
            Single-use link, expires in 72 hours
          </label>
          <div className="flex gap-2">
            <input id="invite-url" className="field font-mono text-xs" readOnly value={url} />
            <button
              type="button"
              className="btn shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function LogExternalForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-quiet no-print mt-3 text-sm"
        onClick={() => setOpen(true)}
      >
        Log a message you were sent elsewhere
      </button>
    );
  }

  return (
    <section className="no-print card mt-3 p-4" aria-label="Log an outside message">
      <h2 className="font-semibold">Log an outside message</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Paste a text or email you received. It goes into the record marked as
        logged by you, so it is never presented as if it came through Between.
      </p>

      <label className="label mt-3" htmlFor="external-body">
        What they sent
      </label>
      <textarea
        id="external-body"
        className="field min-h-24"
        value={body}
        maxLength={4000}
        onChange={(event) => setBody(event.target.value)}
      />

      <label className="label mt-3" htmlFor="external-when">
        When you received it
      </label>
      <input
        id="external-when"
        type="datetime-local"
        className="field"
        value={when}
        onChange={(event) => setWhen(event.target.value)}
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || body.trim().length === 0}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await logExternalMessage({
                body,
                occurredAt: when ? new Date(when).toISOString() : undefined,
              });
              setBody("");
              setWhen("");
              setOpen(false);
              router.refresh();
            } catch {
              setError("That could not be logged. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Adding…" : "Add to record"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
