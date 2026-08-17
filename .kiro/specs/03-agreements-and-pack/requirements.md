# Spec 03 — Agreements and the evidence pack

## Problem

Co-parents rarely argue about whether a message was sent. They argue about what
was agreed. Every existing product stores the conversation and leaves the
commitments buried inside it, so proving "you said you would collect her at five"
means scrolling, screenshotting and arguing about context.

This is the part no incumbent does, and it is the reason the product is more than
a nicer messaging app.

## User stories

### R1 — Commitments are noticed

**As** a parent who just sent a message
**I want** Between to spot what I committed to
**So that** it is tracked without me filling in a form.

Acceptance criteria:

- After sending, any commitment found is offered with the exact sentence it came from.
- Nothing is tracked unless I choose it; I can dismiss a suggestion.
- A quote that is not genuinely part of the message is refused by the database.
- Vague intentions and complaints produce no suggestion.

### R2 — Only the other parent can confirm

**As** a parent
**I want** my co-parent to confirm or dispute what was tracked
**So that** a confirmed agreement means something.

Acceptance criteria:

- Confirm and decline are available only to the parent who did not create it.
- Attempting to confirm my own commitment is refused by the database, not just hidden.
- Every status change writes an audit row in the same transaction.
- An answered agreement cannot be answered again.

### R3 — Time is recorded, not judged

**As** a parent
**I want** an agreement that passed its due date without being done to say so
**So that** a pattern is visible without me keeping score.

Acceptance criteria:

- Overdue is computed when the record is read, so it is right even if the job fails.
- After a 24-hour grace period, a confirmed and undone agreement becomes "missed",
  attributed to Between rather than to either parent.
- No blame language anywhere in the interface.

### R4 — Hand the record to someone else

**As** a parent seeing a solicitor or mediator
**I want** a dated document containing the messages and the agreements
**So that** I do not pay someone to read my phone.

Acceptance criteria:

- A PDF quoting every message in order with its hash, plus every agreement with
  its full history and source quote.
- It states plainly what it does and does not prove.
- It is free and complete. Producing one is recorded.

### R5 — Let the reader check it themselves

**As** a mediator holding a printed pack
**I want** to verify it without an account
**So that** I do not have to trust the parent who handed it to me.

Acceptance criteria:

- The pack prints a head hash; a public page accepts it.
- The page reports verified, altered, or not found.
- It reveals nothing else: no names, no message content, no identifiers.

## Out of scope

Emailing the pack, date-range selection in the UI (the API supports `from`/`to`),
lawyer accounts, expense splitting.
