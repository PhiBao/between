---
inclusion: fileMatch
fileMatchPattern: ["**/*.test.ts", "e2e/**/*.ts", "vitest.config.ts", "playwright.config.ts"]
---

# Testing standards

## What must be tested

The three things that would make this product dangerous if they broke:

1. **The hash chain** — a hash must change when any component of an entry changes,
   and `verifyChain` must catch edits, deletions and reordering.
2. **The fact-preservation guard** — a rewrite that loses or invents a date, time,
   amount, quantity or child's name must be rejected. Include the near-misses:
   `5pm` versus `17:00`, `$75` versus `75 dollars`, an ordinal becoming a
   different ordinal.
3. **Authorization** — a person who is not a member of a record can read nothing
   from it, and no one can confirm their own commitment.

## How to write them

- **Assert on behaviour, not implementation.** No snapshotting of prompts, no
  asserting that a function was called.
- **No test that cannot fail.** `expect(true).toBe(true)` and its cousins are
  worse than no test: they make the suite lie.
- **Never weaken a test to make it pass.** If a test fails, either the code is
  wrong or the expectation was wrong — decide which, in writing, and fix that.
- **Never delete a failing test to go green.**
- **Unit tests must not touch the network.** Use the deterministic `mock`
  provider; it exists for exactly this.
- **End-to-end tests use two browser contexts**, one per parent, because the
  interesting behaviour is between two people. Do not fake the second side.
- **Model-dependent assertions must allow both correct outcomes.** A rewrite may
  legitimately be suggested or blocked by the guard; assert that one of those
  happened and that facts survived — never that a specific sentence came back.
- **Beware hydration in e2e.** Filling a field before React hydrates leaves state
  empty and buttons disabled. Retry until the control is enabled
  (`typeMessage()` in `e2e/two-parents.spec.ts`) instead of adding a sleep.

## Before every commit

`pnpm verify` (typecheck, lint, unit tests). Run `pnpm e2e` before anything that
touches the composer, agreements, the pack, or auth.
