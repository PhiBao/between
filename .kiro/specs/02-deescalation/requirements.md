# Spec 02 — De-escalation at the moment of sending

## Problem

The messages that do the most damage are sent in the ninety seconds after
something goes wrong: a late handover, a missed payment, a cancelled weekend.
Advice arriving later is useless. Existing products warn you that your message
sounds angry (OurFamilyWizard's ToneMeter) but leave you to fix it, which in
practice means sending it anyway.

Two hard problems sit underneath the obvious one:

1. A softened message that quietly loses "5pm on the 28th" or "$75" is worse than
   the angry message, because now the logistics are wrong too.
2. A tool that speaks for a parent in a custody dispute is dangerous. The words
   have to stay theirs.

## User stories

### R1 — Offer, never impose

**As** an angry parent
**I want** to see a calmer version of what I wrote and choose
**So that** I stay in control of what I say.

Acceptance criteria:

- One suggestion, with a short plain-English list of what changed and the exact
  phrases removed.
- Three choices: send as written, send the suggestion, edit it first.
- "Send as written" is always visible and never disabled by the check.
- Asking for a check stores nothing.

### R2 — Never lose or invent a fact

**As** a parent
**I want** the suggestion to keep every date, time, amount, quantity and name
**So that** the calmer version still says the same thing.

Acceptance criteria:

- A suggestion missing any fact from the original is discarded before display.
- A suggestion that introduces a fact not in the original is discarded.
- When discarded, I am told plainly that it was kept as written and why.

### R3 — Do not soften danger

**As** a parent in a frightening situation
**I want** the tool to stop trying to help me phrase a threat
**So that** the product is not laundering something serious.

Acceptance criteria:

- Threats to a person and statements of self-harm are never rewritten.
- Support resources are shown instead, with real contact routes.
- I can still send my own words.

### R4 — Work without a model

**As** whoever is running or reviewing this
**I want** the app to work with no API key
**So that** it can be developed, tested and evaluated offline.

Acceptance criteria:

- A deterministic rule-based provider gives the same three choices.
- The interface labels offline mode; it is never presented as model output.
- The fact guard and risk screen apply identically to it.

### R5 — Never block communication

**As** a parent
**I want** to be able to send my message even when the check fails
**So that** the product cannot come between me and my co-parent.

Acceptance criteria:

- Timeout, malformed output, or an unavailable model all degrade to a quiet note.
- No error state prevents sending.

## Success measure

Rewrite acceptance rate (suggestion chosen ÷ suggestions shown) of at least 50%.
Fact-guard rejections should stay under 5% of checks; higher means the prompt is
unsafe and needs work, not that the guard should be relaxed.
