# Spec 02 — De-escalation — tasks

Status: **complete**

## Wave 1 — guards first (before any model call existed)

- [x] 1.1 `extractFacts()` with span removal so overlapping patterns are not
      double counted
- [x] 1.2 Normalisation: times to 24-hour, money to symbol + amount, ordinals to
      day numbers
- [x] 1.3 `compareFacts()` reporting missing and invented separately
- [x] 1.4 9 unit tests including `5pm`/`17:00`, `$75`/`75 dollars`, dropped child
      name, invented date
- [x] 1.5 `screenRisk()` for threats and self-harm, with `mergeRisk()`
- [x] 1.6 5 unit tests including "the kids are killing me" staying `ok`

## Wave 2 — provider layer

- [x] 2.1 `AiProvider` interface and `RewriteOutcome` union
- [x] 2.2 Verify Bedrock Mantle access: list models, confirm which permit zero
      retention, confirm which support Chat Completions
      → Claude not enabled on this account; `openai.gpt-oss-120b` selected
- [x] 2.3 Mantle client: bearer auth, `store: false`, temperature 0, 20s timeout,
      tolerant JSON extraction, Zod validation
- [x] 2.4 Prompts with explicit refusals, in a reviewed file
- [x] 2.5 Deterministic mock provider held to the identical guard
- [x] 2.6 `scripts/check-retention.ts` and a `pnpm check:retention` script

## Wave 3 — the composer

- [x] 3.1 Textarea, character count, three actions, no hidden send path
- [x] 3.2 Suggestion panel: what changed, phrases removed, send / edit
- [x] 3.3 `blocked_facts` explained in plain words ("Kept as written")
- [x] 3.4 `blocked_safety` shows support resources; send stays enabled
- [x] 3.5 `unavailable` degrades quietly
- [x] 3.6 Offline-mode notice when the mock provider is active
- [x] 3.7 `requestRewrite` action recording counters only — never the draft

## Verification

- [x] 25 unit tests pass
- [x] Live model check on a real hostile message: `$75`, `21st`, `5pm`, `28th` and
      "Mia" all preserved; "ALWAYS", "AGAIN", "Typical", "like a child" removed
- [x] End-to-end asserts facts survive and ammunition does not
- [x] Threat test: no rewrite offered, support shown, send still enabled

## Decisions changed during implementation

- Model requests originally targeted `anthropic.claude-sonnet-5`. It is not
  enabled for this account and does not serve Chat Completions on this endpoint;
  discovered by probing `/v1/models/{id}` rather than by guessing.
- `store: false` was initially assumed sufficient for privacy. The Bedrock
  documentation says otherwise, so model selection was constrained to models that
  permit `data_retention_mode: none`, and the check script was added.
