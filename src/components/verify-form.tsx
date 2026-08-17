"use client";

import { useState } from "react";
import type { VerifyResult } from "@/app/verify/actions";

export function VerifyForm({
  action,
}: {
  action: (hash: string) => Promise<VerifyResult>;
}) {
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-6">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setResult(await action(hash));
          setBusy(false);
        }}
      >
        <label className="label" htmlFor="hash">
          Head hash from the pack
        </label>
        <input
          id="hash"
          className="field font-mono text-xs"
          placeholder="64 characters, e.g. 3f9a…"
          value={hash}
          onChange={(event) => setHash(event.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Checking…" : "Check this pack"}
        </button>
      </form>

      {result ? (
        <div className="card mt-5 p-4" role="status">
          {result.status === "verified" ? (
            <>
              <h2 className="font-semibold text-[var(--color-accent)]">
                This pack verifies
              </h2>
              <p className="mt-1 text-sm">
                A record of {result.entryCount} message
                {result.entryCount === 1 ? "" : "s"} matches this hash, covering{" "}
                {formatDate(result.rangeStart)} to {formatDate(result.rangeEnd)}. The
                pack was produced on {formatDate(result.packCreatedAt)} and the
                record has not been altered since.
              </p>
            </>
          ) : null}

          {result.status === "altered" ? (
            <>
              <h2 className="font-semibold text-[var(--color-danger)]">
                This does not verify
              </h2>
              <p className="mt-1 text-sm">{capitalise(result.reason)}.</p>
            </>
          ) : null}

          {result.status === "not_found" ? (
            <>
              <h2 className="font-semibold">No pack found with that hash</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Check for a typo. Hashes are 64 characters with no spaces.
              </p>
            </>
          ) : null}

          {result.status === "invalid_input" ? (
            <p className="text-sm text-[var(--color-danger)]">{result.message}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
