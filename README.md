# Between

**The neutral record between two homes.**

Between is a co-parenting tool for separated parents who share children and do not
trust each other. It does three things:

1. **Before you send** — offers a calmer version of the message you are about to
   send, keeping every date, time, amount and name exactly as you wrote them.
2. **After you send** — reads the commitments out of the message and tracks
   whether the other parent confirmed them.
3. **When it breaks down** — turns the record into a dated PDF that anyone can
   verify without an account.

Built for the [Ready, Spec, Ship hackathon](https://codingagents.fyi/hackathon/kiro/)
(Aug 2026) with Kiro. All code in this repository was written during the
competition period.

---

## Contents

- [The problem](#the-problem)
- [Why this and not the alternatives](#why-this-and-not-the-alternatives)
- [Try it](#try-it) · test credentials
- [What to look at first](#what-to-look-at-first)
- [How it works](#how-it-works)
- [Run it locally](#run-it-locally)
- [Costs, limits and third parties](#costs-limits-and-third-parties)
- [Security and privacy](#security-and-privacy)
- [Testing](#testing)
- [How Kiro was used](#how-kiro-was-used)
- [What is deliberately not built](#what-is-deliberately-not-built)
- [Known limitations](#known-limitations)

---

## The problem

In the US alone, **13.9 million custodial parents are raising 22.2 million
children under 21 while the other parent lives elsewhere** (US Census Bureau,
2022 data) — more than one in four American children.

Those parents have to keep negotiating: handovers, school payments, weekend swaps,
medical appointments. Two things go wrong constantly:

- **The message that makes it worse.** Sent in the ninety seconds after a late
  handover, and then permanent.
- **The dispute about what was agreed.** Not whether a message was sent, but what
  it committed anyone to.

The existing tools charge for the first problem's symptoms and ignore the second.
In 2026 they also stopped being free: AppClose ended its free plan in January,
TalkingParents removed its free tier on 30 March, and OurFamilyWizard runs
$12.50–$18 per month **per parent**.

## Why this and not the alternatives

| | OurFamilyWizard / TalkingParents / AppClose | Between |
| --- | --- | --- |
| Messages | Stored verbatim | Stored verbatim **and understood** |
| Tone | ToneMeter *warns* you your message sounds angry | Offers a version that keeps your position and drops the ammunition — you always choose |
| Commitments | Buried in the thread | Extracted, quoted, confirmed or declined, with a status history |
| Evidence | PDF export, sometimes gated or charged for | Free, complete, hash-verifiable by anyone |
| Drafts | n/a | **Never stored, never visible to the other parent** |

The wedge is the middle row. No existing product converts messages into tracked,
mutually-confirmed obligations, and that is the thing parents actually fight about.

Three product rules make it trustworthy rather than clever:

- **It never speaks for you.** One suggestion, what changed, and your choice.
  "Send as written" is always one tap away and is never disabled.
- **Facts are sacred.** A suggestion that drops or invents a date, time, amount or
  child's name is discarded before you see it. See
  [`src/lib/safety/facts.ts`](src/lib/safety/facts.ts).
- **It never softens a threat.** Messages containing threats or self-harm are not
  rewritten; support resources are shown and you can still send your own words.

---

## Try it

**Live demo:** _see the submission form for the deployed URL_
(or run it locally in about two minutes — see [Run it locally](#run-it-locally)).

### Test credentials

The demo record is seeded with a realistic, entirely fictional history between two
parents, "Alex" and "Sam", who share two children.

| Role | Email | Password |
| --- | --- | --- |
| Parent A | `alex@between.demo` | `between-demo-2026` |
| Parent B | `sam@between.demo` | `between-demo-2026` |

Sign in as **both** in two browser profiles (or one normal and one private
window). The interesting behaviour is between two people.

### A three-minute tour

1. **Sign in as Alex** → the record, with seven messages and four agreements.
2. **Write something you would regret.** Paste this into the composer:

   > You ALWAYS do this. You were 40 minutes late AGAIN on Friday the 21st and Mia
   > was standing outside in the rain. Typical. You owe me $75 for the school trip
   > and I'm done chasing you like you're a child. Pickup is 5pm on the 28th, do
   > not be late.

   Press **Check before sending**. Note that `40`, `Friday`, `21st`, `$75`, `5pm`,
   `28th` and `Mia` all survive, while "ALWAYS", "AGAIN", "Typical" and "like
   you're a child" do not. Send the suggested version.
3. **Track the commitment** it offers ("Collect Mia at 5pm on the 28th"), quoted
   from your own words.
4. **Sign in as Sam** → **Agreements** → the tracked item is waiting for an
   answer. Confirm it, or decline it. You cannot confirm your own commitment —
   that rule is enforced in the database, not just hidden in the UI.
5. **Try a threat.** Type "If you are late again I will make you regret it." No
   rewrite is offered; support resources appear; sending is still your choice.
6. **Export the pack** → **Pack** → *Download the pack (PDF)*. Every message in
   order with its hash, every agreement with its history, and an honest statement
   of what it does and does not prove.
7. **Verify it as an outsider.** Copy the head hash from the Pack page, open
   `/verify` in a signed-out window, and paste it. That page needs no account —
   it is for the mediator holding a printout.

The same seven beats, with timings and the exact wording used in the submission
video, are in [`VIDEO_DEMO_GUIDE.md`](VIDEO_DEMO_GUIDE.md).

---

## What to look at first

If you are reviewing the code, these five files are where the thinking is:

| File | Why |
| --- | --- |
| [`supabase/migrations/20260817000100_init.sql`](supabase/migrations/20260817000100_init.sql) | RLS, append-only tables, and the trigger that recomputes every entry hash and rejects a forged chain |
| [`src/lib/safety/facts.ts`](src/lib/safety/facts.ts) | The fact-preservation guard — the reason a de-escalated message is safe to send |
| [`src/lib/ai/prompts.ts`](src/lib/ai/prompts.ts) | Prompts as reviewed product surface, with the refusals stated explicitly |
| [`supabase/migrations/20260817000200_operations.sql`](supabase/migrations/20260817000200_operations.sql) | The product's rules as atomic database functions (only the other parent may confirm; a quote must really appear in the message it cites) |
| [`e2e/two-parents.spec.ts`](e2e/two-parents.spec.ts) | The whole loop tested across two browser contexts, one per parent |

---

## How it works

```
┌──────────────────────────────────────────────────────────────────┐
│  Next.js 15 App Router (React 19, TypeScript strict)             │
│                                                                  │
│  /record      composer + timeline      /pack      export         │
│  /agreements  confirm / decline        /verify    public check   │
│                                                                  │
│  server actions ── the only write path ── re-authenticate always │
└───────────┬──────────────────────────────────────┬───────────────┘
            │                                      │
            ▼                                      ▼
┌───────────────────────────┐        ┌─────────────────────────────┐
│  AI layer (interface)     │        │  Supabase Postgres          │
│   • bedrock-mantle        │        │   • RLS on every table      │
│     store:false, temp 0   │        │   • entries: append-only    │
│   • offline (rule-based)  │        │   • hash chain verified by  │
│                           │        │     trigger on insert       │
│  guards, in order:        │        │   • product rules as        │
│   screenRisk → model →    │        │     security-definer fns    │
│   mergeRisk → compareFacts│        │                             │
└───────────────────────────┘        └─────────────────────────────┘
                                                   ▲
                              GitHub Actions cron ──┘  (missed agreements)
```

### The record is append-only, and the database enforces it

`entries` and `agreement_events` have `SELECT` and `INSERT` policies and **no**
`UPDATE` or `DELETE` policy, plus explicit `REVOKE UPDATE, DELETE`. There is no
code path — not even a buggy one — that can rewrite history with a user's session.

That constraint is load-bearing: anything that looks like mutable state has to be
modelled as a new fact instead. "Read" is a row in `entry_reads`, not a column on
the message.

### Every entry is chained, and the chain is checked twice

Each entry is hashed together with the previous entry's hash:

```
hash = sha256( seq | family_id | kind | author_id | occurred_at | sha256(body) | prev_hash )
```

TypeScript computes it ([`src/lib/record/hash.ts`](src/lib/record/hash.ts)) and a
Postgres trigger **recomputes it and rejects the row on mismatch**, under a
per-family advisory lock so two simultaneous sends cannot corrupt the sequence.
The client computes; the database verifies; an exported pack can be checked by
either implementation.

### The model is never trusted

Bedrock output is parsed with Zod, then must pass the risk screen and the
fact-preservation guard before a user sees it. If anything fails, the user simply
sees their own message with a plain explanation. **No failure path ever stops a
parent from sending.**

---

## Run it locally

Roughly two minutes, and it works with no AI credentials.

### Prerequisites

- Node 22.14+ and pnpm 11+
- A free Supabase project (or the credentials for the one in the submission)
- Optionally, a Bedrock API key for the real model

```bash
git clone <this repo> && cd between
pnpm install
cp .env.example .env.local     # fill in the two Supabase values
pnpm db:push                   # apply migrations (needs supabase CLI + link)
pnpm seed                      # create the demo record and both accounts
pnpm dev                       # http://localhost:3000
```

Sign in with the test credentials above.

With `AI_PROVIDER=mock` (the default) the de-escalation and extraction run on a
deterministic rule-based implementation — no network, no key. The interface labels
this as offline demo mode; it is never presented as model output. Set
`AI_PROVIDER=mantle` with a Bedrock API key for the real thing.

### Deploying

Any Node host that runs Next.js works. Set every variable from `.env.example`,
with `APP_URL` as the deployed origin (invite links are built from it). For the
scheduled job, add repository secrets `APP_URL` and `CRON_SECRET` and the
`tick` workflow will call it hourly.

---

## Costs, limits and third parties

| Service | Cost for a reviewer | Notes |
| --- | --- | --- |
| **Supabase** | Free tier | Postgres + Auth. Nothing paid is required. |
| **Amazon Bedrock** (`bedrock-mantle`) | Pay per token; **optional** | About 700 input and 200 output tokens per rewrite. With `openai.gpt-oss-120b` a rewrite costs a fraction of a cent. Set `AI_PROVIDER=mock` to spend nothing. |
| **Vercel / Node host** | Free tier | Any Next.js-capable host. |
| **GitHub Actions** | Free tier | CI and the hourly tick. |

**Rate limits.** Bedrock applies per-model tokens-per-minute quotas on the
`bedrock-mantle` endpoint. The app makes at most two model calls per sent message
(one rewrite, one extraction), each with a 20-second timeout, and degrades quietly
if the endpoint is unavailable.

**Model availability is account-specific.** Anthropic models are not enabled on
the account used here; `openai.gpt-oss-120b` is the default because it is
available *and* permits zero data retention. Run `pnpm check:retention` to see
what your own key can do.

### Attribution

Next.js, React, Tailwind CSS, Supabase (`@supabase/ssr`, `@supabase/supabase-js`),
Zod, pdf-lib, Vitest, Playwright, ESLint, TypeScript — all under their respective
open-source licences. Amazon Bedrock is used as a service. No third-party datasets,
fonts, images or audio are included; the PDF uses the standard PDF fonts.

---

## Security and privacy

The threat model is stated plainly: **the adversary is the other parent**, and in
the worst case an abusive ex.

| Concern | How it is handled |
| --- | --- |
| Authorization | RLS on every table via `is_member(family_id)`; every server action re-authenticates; the browser never touches the database |
| Tampering | Append-only tables, hash chain verified by trigger, public verification page |
| Drafts | Never persisted, never sent to the other parent, never logged |
| Message content | Never written to logs or error messages; `ai_events` holds counters only (kind, outcome, latency, length) |
| Third-party retention | `store: false` on every Bedrock request; the model must permit `data_retention_mode: none`; `pnpm check:retention` reports the real posture |
| Invites | Single-use, 72-hour expiry, stored as a SHA-256 hash so a database leak yields no usable invite |
| Service-role key | Confined to `scripts/` and `/api/jobs/tick`; never in a user request path |
| Scheduled job | Shared secret compared with `timingSafeEqual` |
| Coercive control | No location, no typing indicators, no tone scoring of the other parent, no response-time statistics |
| Headers | Strict CSP with no third-party scripts, HSTS, `frame-ancestors 'none'`, no-referrer-when-downgrade |

Two deliberate trade-offs, stated rather than hidden:

- **You can leave a record, but you cannot erase it.** A record one party can
  delete is worthless to the other.
- **The chain proves the record is unaltered. It does not prove who typed a
  message.** The exported pack says exactly this, and the product never claims
  court admissibility.

**One open item:** the Bedrock account used for the demo has retention mode
`inherit`, which resolves to `default` — so AWS may retain prompts briefly for
abuse detection even with `store: false`. Setting the account to `none` is a
one-line change (`pnpm check:retention` prints it) but it is account-wide and
affects other projects, so it is left as an explicit deployment decision.

---

## Testing

```bash
pnpm verify   # typecheck + lint + 25 unit tests
pnpm e2e      # 3 Playwright specs, two browser contexts
```

**Unit tests** cover the three things that would make this product dangerous if
they broke: the hash chain (11 tests — edits, deletions, reordering, partial
ranges), the fact-preservation guard (9 tests — `5pm` vs `17:00`, `$75` vs
`75 dollars`, dropped names, invented dates), and the risk screen (5 tests,
including that "the kids are killing me" is not treated as a threat).

**End-to-end tests** drive two parents in parallel: a hostile message is
de-escalated with its facts intact, sent, its commitment tracked, confirmed by the
other parent, exported as a real PDF, and the head hash verified in a third,
signed-out browser context. A second spec proves a threat is never softened while
sending stays available, and a third proves the record is unreachable when signed
out.

The seed script is itself a cross-implementation check: it computes hashes in
TypeScript and the database accepts them, which means the SQL and TypeScript
canonical forms agree byte for byte.

---

## How Kiro was used

Kiro CLI wrote effectively all of this code. The interesting part is what it was
pointed at, and what it was prevented from doing.

### Research before code

The product direction came out of a research session before any implementation:
market sizing from US Census custodial-parent data, verified 2026 pricing changes
across the incumbent apps, and a survey of adjacent AI products. That research
killed three earlier candidates — AI check-in calls for elderly parents,
"explain my official letter", and contractor quote comparison — all of which turned
out to be crowded or trivially cloneable. It also produced a correction: a
sub-agent claimed family-reporting was an unfilled gap in elder-care check-in
calls, and a direct check found a product already shipping exactly that for
$14.99/month.

### Steering — six files, three of them conditional

`.kiro/steering/` holds `product.md`, `tech.md` and `structure.md` (always
loaded), plus three that load only when relevant:

- `privacy-and-safety.md` — `fileMatch` on the AI, safety and action layers
- `database-and-rls.md` — `fileMatch` on migrations and record code
- `testing-standards.md` — `fileMatch` on test files and configs

The conditional ones exist because "never log a message body" and "entries are
append-only" matter enormously in four directories and are noise everywhere else.
`product.md` carries the nine non-negotiable product rules, so the agent argues
back when a request would violate one.

### Specs — three, each with requirements, design and tasks

`.kiro/specs/01-record-core`, `02-deescalation`, `03-agreements-and-pack`. The
design documents record *decisions with alternatives*, not descriptions: why the
hash is computed by the client and verified by the database, why extraction
proposes but never persists, why pdf-lib instead of a headless browser. The task
files are the real ones, in waves, and they record what changed during
implementation — including two things the plan got wrong (see below).

### Hooks — four, two of which can stop work

- `lint-on-save.json` — ESLint `--fix` on the saved file, then a full type check
- `guard-secrets.json` — a **`PreToolUse` gate** that blocks any write to `.env*`
  or credential files, and any content matching a JWT, Bedrock key or private key.
  Verified: exits 2 and refuses; a normal file passes.
- `test-after-task.json` — unit tests after every spec task
- `safety-review.json` — an **agent-action** hook that injects a six-point review
  checklist whenever a prompt or a guard file changes

### A custom agent and a skill

`.kiro/agents/record-auditor.json` is a read-only auditor with fifteen named
invariants to check across integrity, authorization, privacy and safety. It is
denied `fs_write` by a permission rule and restricted to four shell commands, so
it reports and a human decides. Validated with `kiro-cli agent validate`.

`.kiro/skills/evidence-pack-review/SKILL.md` is the checklist for reviewing the
exported PDF as a document — including that it must contain agreements unflattering
to the exporting parent, because a one-sided record would be a lie.

### Where human direction changed the outcome

- **Auth was rewritten.** Sign-in started in the browser. The end-to-end test
  failed intermittently, and the cause was the client-side cookie write racing the
  redirect. It moved to server actions so the session cookie lands on the same
  response — a fix that came from reading the failure, not from retrying it.
- **The model choice became a privacy decision.** The plan said `store: false` was
  enough. The Bedrock documentation says it is not a zero-retention guarantee, so
  model selection was constrained to models permitting
  `data_retention_mode: none`, and `scripts/check-retention.ts` was added to prove
  the posture rather than assert it.
- **The first model choice was wrong.** `anthropic.claude-sonnet-5` is not enabled
  on this account and does not serve Chat Completions on this endpoint. Found by
  probing `/v1/models/{id}`, not by guessing.
- **`read_at` was deleted from the schema before it shipped.** A mutable column on
  an append-only table is a contradiction; it became the `entry_reads` table.
- **Test selectors were fixed, never weakened.** One spec matched Next.js's route
  announcer instead of the alert. The fix was a better locator — and the threat
  pattern it exposed ("I will" versus "I'll") was widened, with a unit test.

---

## What is deliberately not built

Expense splitting, a scheduling engine, video calls, GPS check-ins, a document
vault, SMS or push notifications, native apps, mediator or lawyer seats, court
filing, billing. Each would add surface without testing the thesis, and two of
them (GPS, response-time statistics) would actively make the product a tool for
control.

## Known limitations

- **Two parents per record.** No support for step-parents or a third guardian.
- **English only**, and the risk screen is English-language patterns.
- **Read receipts are recorded when the record page is opened**, not per message
  scrolled into view.
- **No date-range picker in the UI.** The download endpoint accepts `from` and
  `to`; the interface exports everything.
- **The extraction model is conservative.** It misses commitments phrased
  obliquely. That is the intended direction of error — a missed commitment is
  recoverable, an invented one is not.
- **Offline mode is rule-based**, so its rewrites are noticeably blunter than the
  model's. It is labelled as such in the interface.

---

MIT licensed. Everything in this repository was written between 16 and 23 August
2026 for the Ready, Spec, Ship hackathon.
