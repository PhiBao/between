# Demo video guide

A three-minute video for the Ready, Spec, Ship submission. The rules require it to
show the project working, explain the problem and the solution, demonstrate the key
features, and explain how Kiro was used. Judges are not required to watch past
3:00, so nothing important goes after 2:50.

The plan below is 2:55 with the narration written out. Read it at a normal pace —
about 430 words — and do not rush the two moments that matter: the facts surviving
the rewrite, and Sam confirming the agreement.

---

## Before you record

```bash
cd ~/kiro
pnpm seed                      # fresh demo record: 7 messages, 4 agreements
AI_PROVIDER=mantle pnpm build  # use the real model, not offline mode
AI_PROVIDER=mantle pnpm start
```

Then, in the browser:

1. **Window A** — normal window, sign in as `alex@between.demo` / `between-demo-2026`.
2. **Window B** — private/incognito window, sign in as `sam@between.demo` / `between-demo-2026`.
3. **Window C** — a second private window on `/verify`, signed out. Leave it open.

Set both windows to a narrow, phone-like width (about 480–560px). The interface is
mobile-first and looks intentional at that size; full-screen desktop makes it look
empty.

Warm the model: do one throwaway rewrite in Window A **before** you start
recording, then reload. The first Bedrock call of a session is the slowest, and
dead air is the most expensive thing in a three-minute video.

Checklist:

- [ ] Zoom to ~125% so text is legible after compression
- [ ] Close every other tab; the URL bar and bookmarks should show nothing private
- [ ] Never show `.env.local`, the Supabase dashboard, or a terminal containing keys
- [ ] Mute notifications (Windows: Focus assist; macOS: Do Not Disturb)
- [ ] Have the paste text below on your clipboard, not typed live

**Recording tool.** This project is developed in WSL2, so record on the Windows
side: `Win + Alt + R` (Xbox Game Bar) captures a single window with audio, or use
Loom or OBS if you want a webcam bubble. No webcam is required.

**Paste text** (copy this exactly — the facts in it are what the guard protects):

```
You ALWAYS do this. You were 40 minutes late AGAIN on Friday the 21st and Mia was standing outside in the rain. Typical. You owe me $75 for the school trip and I'm done chasing you like you're a child. Pickup is 5pm on the 28th, do not be late.
```

---

## Shot list and script

### 0:00 – 0:22 · The problem

**Show:** Window A on `/record`, the seeded thread scrolled so a few messages and
an agreement line are visible.

> "Thirteen point nine million American parents are raising children with an ex who
> lives somewhere else. They argue about two things: the message that got sent in
> anger, and what was actually agreed. Existing co-parenting apps store the
> messages and leave you to fight about the rest — and in 2026 they all stopped
> being free. This is Between."

### 0:22 – 1:20 · Before you send

**Show:** Click into the composer, paste the message, press **Check before sending**.

> "Here's a message a parent would regret. Between doesn't warn you that it sounds
> angry — it offers a version that keeps your position and drops the ammunition."

Wait for **A calmer version**. Then use your cursor to point at each surviving
fact as you say it:

> "Forty minutes. Friday the twenty-first. Seventy-five dollars. Five pm on the
> twenty-eighth. Mia's name. Every fact survived. 'ALWAYS', 'AGAIN', 'Typical',
> 'like you're a child' did not. That isn't the model being trusted — a rewrite
> that drops or invents a date, a time, an amount or a child's name is thrown away
> before you ever see it. And sending your own words is always one tap away."

Point at **Send as written**, then click **Send this version**.

### 1:20 – 1:32 · The commitment

**Show:** the "Looks like you committed to something" panel appearing.

> "It also read the commitment out of what I just sent, quoted from my own words.
> I decide whether it's tracked."

Click **Track this**.

### 1:32 – 1:58 · The other parent

**Show:** switch to Window B (Sam). Go to **Agreements**.

> "Now the other parent. Sam sees it waiting for an answer — and Sam is the only
> one who can answer it. I can't confirm my own commitment, and that rule lives in
> the database, not just hidden in the interface."

Click **That is right**. Show the status becoming **Confirmed** with the history
line underneath.

### 1:58 – 2:22 · The pack, and checking it

**Show:** back to Window A → **Pack** → **Download the pack (PDF)**. Open the PDF
and scroll once through the integrity block, an agreement with its quote, and the
message log with hashes.

> "When it breaks down, the record becomes a dated pack: every message in order
> with its hash, every agreement with its history, and an honest statement that
> this proves the record is unaltered — not who typed it."

Copy the head hash, switch to Window C (`/verify`, signed out), paste, click
**Check this pack**.

> "And anyone can check it without an account. This page is for the mediator
> holding a printout."

Show **This pack verifies**.

### 2:22 – 2:50 · How Kiro built it

**Show:** editor or terminal with `.kiro/` expanded — `steering/`, `specs/`,
`hooks/`, `agents/`. Open `product.md` briefly, then `guard-secrets.json`.

> "Kiro wrote effectively all of this, and what it was pointed at is the
> interesting part. Six steering files — three of them conditional, so 'never log a
> message body' loads only in the AI and safety layers. Three specs, whose design
> documents record the alternatives, not just the decisions. Four hooks, two of
> which can stop work: this one blocks any write to an environment file or anything
> shaped like a key. And a read-only auditor agent with fifteen invariants, which I
> ran before submitting — it found two low-severity issues, and both are fixed."

**Optional, only if you are under time:** in Window A, type
`If you are late again I will make you regret it.` and press **Check before
sending** to show the refusal.

> "One more rule: it never softens a threat. Support resources instead — and you
> can still send your own words."

### 2:50 – 2:55 · Close

**Show:** the record page.

> "Twenty-eight unit tests, three end-to-end specs driving two parents at once.
> Between — the neutral record between two homes."

---

## If something goes wrong while recording

| Problem | What to do |
| --- | --- |
| The rewrite says **Kept as written** | Do not re-record — this is a feature. Say: "the calmer version tried to change a detail, so it was discarded and my own words were kept." Then continue. |
| Bedrock is slow or unavailable | The composer still sends. Either cut to the offline-mode take, or say "the check is unavailable, and sending is never blocked." |
| No commitment is offered | Extraction is deliberately conservative. Use the seeded agreement in Window B instead of a fresh one. |
| The verify page says altered | The record grew after that pack was produced. Re-download the pack, then use its hash. |

---

## Publishing

- Upload to YouTube as **Unlisted**, or Loom with link sharing on. Anyone with the
  link must be able to watch it without signing in or requesting access.
- Title: `Between — the neutral record between two homes (Kiro hackathon)`.
- Confirm the link works in a signed-out private window before submitting.

## What the submission form needs

- Repository: `https://github.com/PhiBao/between` (public, `.kiro/` at the root)
- Video link (unlisted is fine)
- Deployed URL, plus the test credentials from the README:
  `alex@between.demo` and `sam@between.demo`, password `between-demo-2026`
- Note that the app also runs locally with no AI key on the offline provider
- Deadline: **23 August 2026, 23:59 UTC**. Submit a day early.
