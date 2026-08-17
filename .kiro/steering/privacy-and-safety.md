---
inclusion: fileMatch
fileMatchPattern: ["src/lib/ai/**/*.ts", "src/lib/safety/**/*.ts", "src/app/actions.ts", "src/app/api/**/*.ts"]
---

# Privacy and safety rules for the AI and action layer

Load this whenever touching prompts, providers, safety checks, or server actions.
The threat model is **the other parent**, and in the worst case an abusive ex.

## Hard rules

1. **No message text leaves the request.** Do not log bodies, do not put them in
   error messages, do not store them for analytics. `ai_events` records
   `kind`, `outcome`, `model`, `latency_ms`, `input_chars` — nothing else.
2. **Drafts are not persisted.** `requestRewrite` takes text, returns a verdict,
   and stores nothing. If you find yourself wanting a `drafts` table, stop: a
   stored draft is a weapon in a custody dispute.
3. **`store: false` on every Bedrock request**, and the model must permit
   `data_retention_mode: none`. Run `pnpm check:retention` after changing models.
4. **The guard runs after every rewrite**, for the mock provider too. Order:
   local risk screen → model → merge model's safety verdict → equality check →
   `compareFacts`. Any failure returns the user's own text.
5. **Fact loss and fact invention are both failures.** Invention is worse: it puts
   words in someone's mouth that can be quoted back at them later.
6. **Never soften a threat or self-harm statement.** Return
   `blocked_safety` with the support message, and keep "send as written" enabled.
   The product does not decide who may speak.
7. **Extraction never writes.** Candidate agreements are offered to the user and
   only saved when they choose. The source quote must be an exact substring of
   the message; the database re-checks this and will reject a fabricated quote.
8. **Every action re-authenticates.** Call `requireContext()`; never take
   `familyId`, `userId` or membership from the client.
9. **Fail open for communication, closed for data.** If the model is down, the
   user can still send. If authorization is uncertain, refuse.

## When adding a prompt

- Put it in `src/lib/ai/prompts.ts` with the reasoning in a comment. Prompts are
  reviewed product surface, not inline strings.
- State the refusals explicitly (no legal advice, no parenting advice, no comment
  on either parent's character). A general model will drift into all three.
- Add or extend a test in `src/lib/safety/facts.test.ts` for any new class of fact
  the prompt is now responsible for preserving.
