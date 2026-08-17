---
inclusion: fileMatch
fileMatchPattern: ["supabase/migrations/**/*.sql", "src/lib/record/**/*.ts", "src/lib/supabase/**/*.ts"]
---

# Database and RLS rules

The database is the authorization boundary. Assume the application layer will one
day have a bug, and that one of the two people in a record would exploit it.

## Invariants

1. **RLS is enabled on every table**, and access is granted through
   `public.is_member(family_id)` — never by comparing IDs in application code.
2. **`entries` and `agreement_events` are append-only.** They have `SELECT` and
   `INSERT` policies and no `UPDATE`/`DELETE` policy, plus explicit
   `REVOKE UPDATE, DELETE ... FROM authenticated`. If a feature seems to need an
   update on these tables, model the change as a new row instead — that is why
   `entry_reads` exists rather than a mutable `read_at` column.
3. **The hash chain is verified in the database.** `entries_chain_guard()` takes a
   per-family advisory lock, checks `seq` and `prev_hash` continuity, and
   recomputes the hash with `entry_canonical()`. A client cannot write a forged
   chain even with a valid session.
4. **`entry_canonical()` and `src/lib/record/hash.ts` must agree byte for byte.**
   Timestamps are `YYYY-MM-DDTHH:MM:SS.MSZ` in UTC and the body is hashed
   separately so the canonical string is fixed length. Changing either side
   without the other silently breaks every future append.
5. **Multi-write operations are security-definer functions**, so the rule and its
   audit row commit together: `create_family`, `accept_invite`, `create_agreement`,
   `set_agreement_status`, `mark_missed_agreements`.
6. **Product rules that must never be bypassed live in those functions**:
   only the other parent may confirm or decline; a source quote must actually
   appear in the message it cites; a record holds at most two parents; an invite
   is single-use and expiring.
7. **Invite tokens are stored hashed.** The raw token exists only in the link.
8. **`service_role` never serves a user request.** It is for `scripts/` and
   `/api/jobs/tick` only. `mark_missed_agreements` is granted to `service_role`
   and revoked from `authenticated`.

## When adding a migration

- One concern per file, timestamp-prefixed, applied with `pnpm db:push`.
- Write the *why* as a SQL comment at the top — these files are read by people
  deciding whether to trust the product.
- Adding a table means adding its RLS policies in the same migration. A table
  with RLS enabled and no policy is invisible; a table without RLS is a leak.
