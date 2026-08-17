# Spec 01 — Record core — tasks

Status: **complete**

## Wave 1 — schema and integrity (parallel)

- [x] 1.1 Create `20260817000100_init.sql`: families, memberships, children,
      invites, entries, entry_reads, agreements, agreement_events, packs, ai_events
- [x] 1.2 Write `entry_canonical()` and `entries_chain_guard()` with the advisory
      lock and hash recomputation
- [x] 1.3 Enable RLS on every table; `is_member()` helper; append-only policies
      plus `REVOKE UPDATE, DELETE`
- [x] 1.4 Implement `src/lib/record/hash.ts` mirroring the SQL canonical form
- [x] 1.5 Unit tests for hash sensitivity and `verifyChain`
      → 11 tests in `src/lib/record/hash.test.ts`

## Wave 2 — operations

- [x] 2.1 `20260817000200_operations.sql`: `create_family`, `accept_invite`,
      `create_agreement`, `set_agreement_status`
- [x] 2.2 Grant execute to `authenticated` only, revoked from `public`
- [x] 2.3 Verify the quote-provenance check rejects a fabricated source quote

## Wave 3 — application plumbing

- [x] 3.1 `src/lib/env.ts` with Zod validation and fail-fast on a misconfigured
      AI provider
- [x] 3.2 Supabase clients: server (session, used everywhere), browser (nothing
      but auth), admin (scripts and the cron job only)
- [x] 3.3 `appendEntry()` with head read, hash computation, and race retry
- [x] 3.4 Read queries: family context, entries with read receipts, agreements
- [x] 3.5 Middleware for session refresh and route protection

## Wave 4 — surfaces

- [x] 4.1 Landing page that redirects a signed-in parent to the right place
- [x] 4.2 Sign in / sign up as **server actions**
      (moved from client-side after e2e showed the cookie write racing the redirect)
- [x] 4.3 Onboarding: first name + children, then straight to the composer
- [x] 4.4 Record timeline with sequence numbers, delivered/read, and the
      "logged by you" label
- [x] 4.5 Invite creation and the join page
- [x] 4.6 Log-an-outside-message form with future-date clamping

## Verification

- [x] `pnpm verify` clean
- [x] Seed script writes 7 chained entries that the database trigger accepts —
      proving the TypeScript and SQL hash implementations agree
- [x] `/record` redirects to `/sign-in` when unauthenticated (e2e)

## Notes for the next spec

`rewrite_used` is already on `entries` so spec 02 only has to set it. The
composer is intentionally the only place that writes a `sent` entry.
