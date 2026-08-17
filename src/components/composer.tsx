"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestRewrite, sendMessage, trackAgreement } from "@/app/actions";
import type { CandidateAgreement, RewriteOutcome } from "@/lib/ai/types";

/**
 * The composer is where the product earns its keep: the help arrives at the
 * moment of maximum emotion, and the parent always chooses what gets sent.
 *
 * Rules encoded here:
 *  - "Send as written" is always available and never hidden.
 *  - A suggestion is shown with what changed, so it is never a black box.
 *  - Drafts stay in this component. Nothing is stored until the parent sends.
 */

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "result"; outcome: RewriteOutcome };

interface Props {
  otherName: string | null;
  offlineMode: boolean;
}

export function Composer({ otherName, offlineMode }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });
  const [candidates, setCandidates] = useState<CandidateAgreement[]>([]);
  const [lastEntryId, setLastEntryId] = useState<string | null>(null);
  const [tracked, setTracked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggestion =
    check.kind === "result" && check.outcome.status === "suggested"
      ? check.outcome.suggestion
      : null;

  const canSend = text.trim().length > 0 && !pending;

  async function onCheck() {
    setError(null);
    setCheck({ kind: "checking" });
    try {
      const outcome = await requestRewrite(text);
      setCheck({ kind: "result", outcome });
    } catch {
      setCheck({
        kind: "result",
        outcome: { status: "unavailable", reason: "network" },
      });
    }
  }

  async function onSend(body: string, usedSuggestion: boolean) {
    setError(null);
    try {
      const result = await sendMessage({ body, usedSuggestion });
      setText("");
      setCheck({ kind: "idle" });
      setCandidates(result.candidates);
      setLastEntryId(result.entryId);
      setTracked(new Set());
      startTransition(() => router.refresh());
    } catch {
      setError("That did not send. Your message is still here — try again.");
    }
  }

  async function onTrack(index: number, candidate: CandidateAgreement) {
    if (!lastEntryId) return;
    const result = await trackAgreement({
      entryId: lastEntryId,
      text: candidate.text,
      sourceQuote: candidate.sourceQuote,
      owner: candidate.owner,
      dueAt: candidate.dueAt ? candidate.dueAt.toISOString() : null,
    });

    if (result.ok) {
      setTracked((previous) => new Set(previous).add(index));
      startTransition(() => router.refresh());
    } else {
      setError(result.error ?? "That could not be tracked.");
    }
  }

  return (
    <section className="no-print card p-4" aria-label="Write a message">
      <label className="label" htmlFor="composer">
        {otherName ? `Message to ${otherName}` : "Message to the other parent"}
      </label>

      <textarea
        id="composer"
        className="field min-h-28"
        placeholder="Say what you need to say. Between will offer a calmer version before it goes anywhere."
        value={text}
        maxLength={4000}
        onChange={(event) => {
          setText(event.target.value);
          if (check.kind !== "idle") setCheck({ kind: "idle" });
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn"
          onClick={onCheck}
          disabled={!canSend || check.kind === "checking"}
        >
          {check.kind === "checking" ? "Reading it back…" : "Check before sending"}
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSend(text, false)}
          disabled={!canSend}
        >
          Send as written
        </button>

        <span className="ml-auto text-xs text-[var(--color-muted)]">
          {text.length}/4000
        </span>
      </div>

      {offlineMode ? (
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          Offline demo mode: suggestions come from local rules, not a model. Set
          <code className="mx-1">AI_PROVIDER=mantle</code>for the real thing.
        </p>
      ) : null}

      {check.kind === "result" ? (
        <CheckResult
          outcome={check.outcome}
          onUse={(value) => onSend(value, true)}
          onEdit={(value) => {
            setText(value);
            setCheck({ kind: "idle" });
          }}
          disabled={pending}
        />
      ) : null}

      {suggestion === null && check.kind === "checking" ? (
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Checking the wording. Your draft has not been saved or sent.
        </p>
      ) : null}

      {candidates.length > 0 ? (
        <div className="mt-4 rounded-xl bg-[var(--color-accent-soft)] p-3">
          <h2 className="text-sm font-semibold">
            Looks like you committed to something
          </h2>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            Track it and {otherName ?? "the other parent"} can confirm or decline
            it. Nothing is tracked unless you choose it.
          </p>
          <ul className="mt-3 space-y-2">
            {candidates.map((candidate, index) => (
              <li key={`${candidate.sourceQuote}-${index}`} className="card p-3">
                <p className="text-sm font-medium">{candidate.text}</p>
                {candidate.dueAt ? (
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    Due {formatDue(candidate.dueAt)}
                  </p>
                ) : null}
                <p className="quote mt-2">“{candidate.sourceQuote}”</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary text-sm"
                    disabled={tracked.has(index)}
                    onClick={() => onTrack(index, candidate)}
                  >
                    {tracked.has(index) ? "Tracked" : "Track this"}
                  </button>
                  {!tracked.has(index) ? (
                    <button
                      type="button"
                      className="btn btn-quiet text-sm"
                      onClick={() =>
                        setCandidates((previous) =>
                          previous.filter((_, position) => position !== index),
                        )
                      }
                    >
                      Not an agreement
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function CheckResult({
  outcome,
  onUse,
  onEdit,
  disabled,
}: {
  outcome: RewriteOutcome;
  onUse: (value: string) => void;
  onEdit: (value: string) => void;
  disabled: boolean;
}) {
  if (outcome.status === "suggested") {
    return (
      <div className="mt-4 rounded-xl border border-[var(--color-line)] bg-[#f8f6f3] p-3">
        <h2 className="text-sm font-semibold">A calmer version</h2>
        <p className="mt-2 whitespace-pre-wrap text-[0.95rem]">{outcome.suggestion}</p>

        {outcome.whatChanged.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-[var(--color-muted)]">
            {outcome.whatChanged.map((note) => (
              <li key={note}>• {note}</li>
            ))}
          </ul>
        ) : null}

        {outcome.removedPhrases.length > 0 ? (
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Removed: {outcome.removedPhrases.map((phrase) => `“${phrase}”`).join(", ")}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={disabled}
            onClick={() => onUse(outcome.suggestion)}
          >
            Send this version
          </button>
          <button
            type="button"
            className="btn text-sm"
            disabled={disabled}
            onClick={() => onEdit(outcome.suggestion)}
          >
            Edit it first
          </button>
        </div>
      </div>
    );
  }

  if (outcome.status === "unchanged") {
    return (
      <p className="mt-3 text-sm text-[var(--color-muted)]">
        This already reads calmly. Nothing to change.
      </p>
    );
  }

  if (outcome.status === "blocked_facts") {
    return (
      <div className="mt-3 rounded-xl bg-[var(--color-warn-soft)] p-3 text-sm text-[var(--color-warn)]">
        <p className="font-medium">Kept as written.</p>
        <p className="mt-1">
          The calmer version would have changed the details, so it was discarded.
          {outcome.missing.length > 0 ? ` It dropped: ${outcome.missing.join(", ")}.` : ""}
          {outcome.invented.length > 0
            ? ` It added: ${outcome.invented.join(", ")}.`
            : ""}
        </p>
      </div>
    );
  }

  if (outcome.status === "blocked_safety") {
    return (
      <div
        role="alert"
        className="mt-3 rounded-xl bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger)]"
      >
        {outcome.message}
      </div>
    );
  }

  return (
    <p className="mt-3 text-sm text-[var(--color-muted)]">
      The wording check is unavailable right now. You can still send your message
      as written.
    </p>
  );
}

function formatDue(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
