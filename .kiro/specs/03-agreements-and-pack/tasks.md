# Spec 03 — Agreements and the evidence pack — tasks

Status: **complete**

## Wave 1 — extraction

- [x] 1.1 Extraction prompt: exact-substring quotes, owner attribution, ISO due
      dates, empty list rather than invention
- [x] 1.2 Zod schema with a maximum of five candidates
- [x] 1.3 Drop candidates whose quote is not a substring of the message
- [x] 1.4 Mock extraction: commitment verb plus a concrete detail, with month
      rollover for "the 28th"
- [x] 1.5 Offer candidates in the composer with "Track this" / "Not an agreement"

## Wave 2 — lifecycle

- [x] 2.1 `create_agreement()` with the SQL provenance check and the first audit row
- [x] 2.2 `set_agreement_status()`: only the other parent may confirm or decline;
      no double answers; audit row in the same transaction
- [x] 2.3 Agreements page: plain-sentence cards, source quote, full history
- [x] 2.4 Two filters only ("Needs attention", "Everything") — no table
- [x] 2.5 Waiting-on-you notice on the record page
- [x] 2.6 `20260817001200_missed_agreements.sql` with `mark_missed_agreements()`
      granted to `service_role` alone
- [x] 2.7 `/api/jobs/tick` with a timing-safe secret comparison
- [x] 2.8 GitHub Actions schedule calling the tick

## Wave 3 — the pack

- [x] 3.1 `buildPack()`: range filter, chain verification, head hash, parties
- [x] 3.2 `renderPackPdf()`: header, integrity block, agreements, full message log
      with per-entry hashes, page numbers
- [x] 3.3 Word wrap measured against the embedded font; WinAnsi sanitiser
- [x] 3.4 Download route recording the pack and streaming the PDF
- [x] 3.5 Pack page describing the contents in plain English
- [x] 3.6 Honest limits printed inside the document

## Wave 4 — public verification

- [x] 4.1 `verifyPackHash()` — service role, hash-only lookup, verdict-only response
- [x] 4.2 Second check: chain head must equal the hash printed on the pack
- [x] 4.3 `/verify` page usable with no account

## Verification

- [x] End-to-end: track → confirm as the other parent → download PDF (`%PDF-`,
      `application/pdf`) → verify head hash anonymously → "This pack verifies"
- [x] Tick endpoint: `{"ok":true,"markedMissed":1}` with the secret, 401 without
      it and 401 with a wrong one
- [x] `pnpm verify` clean; 25 unit tests, 3 end-to-end tests passing

## Deliberately not done

Date-range pickers in the UI (the API takes `from` and `to`), emailing a pack,
mediator accounts. Each would add surface without testing the thesis.
