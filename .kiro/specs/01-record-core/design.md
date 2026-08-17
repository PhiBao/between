# Spec 01 — Record core — design

## Decision 1: the chain is computed by the client and verified by the database

Options considered:

| Option | Why not / why |
| --- | --- |
| Hash in the application only | A bug or a compromised session could write an inconsistent chain that only shows up much later, when the record matters most. |
| Hash in the database only | Loses the ability to verify an exported pack outside the database, which is the whole point of the pack. |
| **Both: client computes, trigger recomputes and rejects on mismatch** | Chosen. The verification path is independent of the writing path, and the same canonical form is used by the public verify page. |

Consequence: `entry_canonical()` in SQL and `entryCanonicalString()` in
TypeScript must agree byte for byte. Timestamps are formatted to exactly
millisecond precision in UTC on both sides, and the body is hashed separately so
the canonical string has fixed length and no delimiter-injection risk.

Canonical string:

```
seq | family_id | kind | author_id | occurred_at(ms, UTC) | sha256(body) | prev_hash
```

## Decision 2: append-only is enforced by the absence of a policy

RLS is default-deny. `entries` gets `SELECT` and `INSERT` policies and no
`UPDATE` or `DELETE` policy, plus an explicit `REVOKE UPDATE, DELETE`. There is
no code path — not even a buggy one — that can rewrite history with a user's
session.

This forces a useful constraint: anything that looks like mutable state has to be
modelled as a new fact. "Read" becomes a row in `entry_reads` rather than a column
on the message.

## Decision 3: concurrency

Two parents can send at the same moment. The trigger takes
`pg_advisory_xact_lock(hashtextextended(family_id))`, so appends to one record
serialise while different records proceed in parallel. The client reads the head,
computes, inserts, and retries up to four times if it lost the race
(`append_failed` only after that).

`unique (family_id, seq)` and `unique (family_id, hash)` make the race
impossible to lose silently.

## Decision 4: family creation and invites are security-definer functions

Creating a family requires inserting a `families` row before any membership
exists — which RLS must not allow directly. `create_family()` does both writes
atomically as one operation the caller cannot decompose.

`accept_invite()` enforces single use, expiry, and the two-parent cap under
`SELECT ... FOR UPDATE`, so two people cannot both consume one invite.

## Data model

```
families         id, label, created_at
memberships      family_id, user_id, display_name, status   unique(family_id,user_id)
children         family_id, name
invites          family_id, token_hash unique, created_by, expires_at, accepted_at/by
entries          family_id, seq, kind, author_id, author_name, body,
                 occurred_at, created_at, rewrite_used, prev_hash, hash
                 unique(family_id,seq), unique(family_id,hash)   APPEND ONLY
entry_reads      (entry_id, user_id) pk, family_id, read_at      APPEND ONLY
```

## Edge cases

| Case | Behaviour |
| --- | --- |
| First entry in a record | `seq = 1`, `prev_hash` = 64 zeros, enforced by the trigger |
| Concurrent sends | Advisory lock + retry; unique constraints as the backstop |
| Body with unusual characters | Stored as sent; hashed by content so length is irrelevant |
| Logged message dated in the future | Clamped to now |
| Invite reused | Rejected, "invite already used" |
| Invite for a full record | Rejected, "this record already has two parents" |
| Third party guesses a family id | RLS returns nothing; membership is required |

## Test plan

- Unit: canonical timestamp formatting, hash sensitivity to every field, chain
  verification against edit / deletion / reorder / partial range.
- Integration by construction: the seed script computes hashes in TypeScript and
  the database accepts them, which proves the two implementations agree.
- End-to-end: unauthenticated access to `/record` redirects to sign-in.
