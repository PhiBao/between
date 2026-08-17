# Spec 03 — Agreements and the evidence pack — design

## Agreement lifecycle

```
                    ┌──────────────┐
   extraction ─────►│   proposed   │
   (user accepts)   └──────┬───────┘
                           │ only the OTHER parent
                ┌──────────┴──────────┐
                ▼                     ▼
          ┌───────────┐         ┌──────────┐
          │ confirmed │         │ declined │  (terminal)
          └─────┬─────┘         └──────────┘
        either  │        ┌──────────────┐
        parent  ├───────►│     done     │  (terminal)
                │        └──────────────┘
   scheduled    │        ┌──────────────┐
   job, +24h    └───────►│    missed    │
                         └──────────────┘
```

Enforced in `set_agreement_status()` and `mark_missed_agreements()`, not in the
UI, so the rules hold for any future client.

## Decision: extraction proposes, the user disposes, the database checks

Three layers, because each is fallible in a different way:

1. The model proposes commitments with an exact source quote.
2. TypeScript drops any candidate whose quote is not a substring of the message.
3. `create_agreement()` re-checks `position(quote in body) > 0` in SQL.

Provenance is the product's whole claim, so it is verified where it cannot be
bypassed. Candidates are **not** persisted before the user accepts them — they are
returned from `sendMessage()` and live in component state only. A rejected
suggestion leaves no trace, which matters when the suggestion was wrong.

## Decision: overdue is derived, missed is recorded

"Overdue" is a function of the current time and is computed on read, so a failed
cron job cannot make the interface lie. "Missed" is a durable statement about the
past, so it is written once, with an audit row, attributed to `Between` with
`actor_id = null` — neither parent is made the author of that judgement.

The 24-hour grace period exists so that marking a handover done an hour late is
not recorded as a miss.

## Decision: pdf-lib, not a headless browser

The pack must render identically anywhere, install with no native binaries, and
produce the same bytes for the same record. pdf-lib gives that. The cost is manual
layout: a greedy word wrap measured against the embedded font, explicit page
breaks, and a WinAnsi sanitiser (curly quotes, dashes and emoji folded to safe
characters, since standard PDF fonts cannot encode them).

Layout is deliberately plain — it reads like a statement, not a screenshot.

## Decision: verification reveals a verdict and nothing else

The verify page must work for someone with no account, so it runs with the
service role. That makes its response shape a security decision. Lookup is by
head hash, a 64-character digest that is not guessable, and the response contains
only: verified / altered / not found, an entry count, and the dates. No names, no
content, no identifiers.

Two checks must both pass: the chain must verify, and its head must equal the hash
printed on the pack. The second catches a record that has legitimately grown since
the pack was produced.

## Honest limits, stated in the pack itself

- Shows: what was recorded here, and that it has not been altered since.
- Does not show: who typed a message, or whether an account belongs to who it says.
- Is not: legal advice, or a claim of court admissibility.

## Edge cases

| Case | Behaviour |
| --- | --- |
| Export with no messages | 400 and a clear message; no empty PDF |
| Message containing emoji or curly quotes | Sanitised for the PDF; the record keeps the original |
| Very long message | Wrapped, with hard breaks for unbroken strings |
| Agreement whose entry falls outside the range | Excluded, so the pack is internally consistent |
| Record grew after the pack was produced | Verify reports altered, with the reason |
| Both parents confirm simultaneously | `SELECT ... FOR UPDATE`; the second gets "already answered" |
| Cron never runs | Overdue still correct on read; only "missed" is delayed |

## Test plan

- End-to-end: track an agreement as one parent, confirm as the other, download the
  pack (assert `%PDF-` and the content type), then verify the head hash in a
  third, anonymous browser context.
- Behavioural: the tick endpoint rejects a missing or wrong secret (401) and
  reports how many agreements it marked missed.
