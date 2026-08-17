# Spec 01 — Record core

## Problem

Separated parents already keep evidence: screenshots, forwarded emails, notes in
a phone. It is unordered, easy to dispute, and trivially selective. Incumbent
co-parenting apps store messages but the store is only as trustworthy as the
vendor, and at least one of them charges to get your own data out.

The record has to be the first thing built, because everything else in the
product either writes to it or reads from it.

## User stories

### R1 — Start a record alone

**As** a separated parent
**I want** to create a record with just my name and my children's first names
**So that** I can start using it tonight without involving my ex.

Acceptance criteria:

- Onboarding asks for my first name and up to two children's names. Nothing else.
- After onboarding I land on the record with the composer ready.
- The record works fully with one parent: send, log, track, export.

### R2 — Send a message into the record

**As** a parent
**I want** the message I send to be stored exactly as sent, in order
**So that** neither of us can later claim it said something else.

Acceptance criteria:

- A sent message is appended with a sequence number, an author and a UTC timestamp.
- Messages are shown oldest to newest with their sequence numbers visible.
- Nothing in the product can edit or delete a message once sent — including me.

### R3 — Log a message received elsewhere

**As** a parent whose ex will not use the app
**I want** to paste in a text or email I received
**So that** the record covers the whole conversation, not just my half.

Acceptance criteria:

- I can paste the content and say when I received it.
- The entry is labelled as logged by me and not presented as delivered in-app.
- A future date is rejected and clamped to now.

### R4 — Invite the other parent

**As** a parent
**I want** to invite my co-parent with a link
**So that** messages are delivered in-app and they can answer agreements.

Acceptance criteria:

- The link is single-use, expires in 72 hours, and is unguessable.
- Only a hash of the token is stored.
- A record holds at most two parents; a third attempt is refused with a clear message.
- After joining, both parents see the same entries in the same order.

### R5 — Know it has not been altered

**As** a parent, and later as whoever reads my export
**I want** to be able to check that the record has not been changed
**So that** the record is worth something in an argument.

Acceptance criteria:

- Each entry is hashed together with the previous entry's hash.
- An edit, deletion or reordering is detectable.
- A forged hash is rejected at write time, not merely detected later.

### R6 — Read receipts as facts

**As** a parent
**I want** to see that the other parent has opened my message
**So that** "I never saw that" is answerable.

Acceptance criteria:

- Delivered and read are shown for in-app messages I sent.
- Recording a read does not modify the message itself.
- No typing indicators, no response-time statistics, no scoring of the other parent.

## Out of scope for this spec

De-escalation (spec 02), agreements and the evidence pack (spec 03), any
notification delivery.

## Non-functional requirements

- The threat model is the other parent: authorization is enforced in the database.
- Two simultaneous sends must not corrupt the sequence or the chain.
- No message body is ever written to logs.
