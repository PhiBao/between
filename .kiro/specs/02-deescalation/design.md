# Spec 02 — De-escalation — design

## Pipeline

```
text
 ├─ screenRisk(text)                    local, cheap, no network
 │    threat / self_harm  ─────────────► blocked_safety + support resources
 ├─ model call (Bedrock Mantle, store:false, temperature 0)
 ├─ Zod parse; tolerant JSON extraction (fences, prose)
 │    failure ─────────────────────────► unavailable (user sends as written)
 ├─ mergeRisk(local, model)             either source can block
 ├─ identical after whitespace? ───────► unchanged ("this already reads calmly")
 ├─ compareFacts(original, suggestion, childNames)
 │    missing or invented ─────────────► blocked_facts, with the reason shown
 └─ suggested { suggestion, whatChanged, removedPhrases }
```

Every branch ends somewhere the user can still send. There is no state in which
the product refuses to let a parent communicate.

## Decision: a deterministic guard, not a better prompt

The prompt asks the model to preserve facts. That is necessary and insufficient —
it will occasionally comply approximately. So the guard is mechanical:

`extractFacts()` pulls money, clock times, dates, weekday/month words, bare
quantities and supplied names, **removing each matched span as it goes** so the
`5` in `5pm` is not also counted as a quantity. Values are normalised before
comparison (`5:30pm` → `17:30`, `75 dollars` → `$75`, `21st` → `21`) so a
legitimate reformatting is not treated as a loss.

Both directions are failures. Losing a fact breaks the logistics; inventing one
puts words in the sender's mouth that can be quoted back at them. Invention is
the more dangerous of the two, which is why it is not merely flagged.

## Decision: model choice is a privacy decision

Bedrock retention is set per account or project, not per request, and
`store: false` alone is not a zero-retention guarantee. So the model must be one
whose `allowed_modes` include `none`. Anthropic models are not enabled on this
account; `openai.gpt-oss-120b` is available, permits zero retention, and returned
correct structured JSON in about 1.7 seconds during evaluation. It is the default,
overridable by `BEDROCK_MODEL_ID`.

`pnpm check:retention` reports the effective mode and exits non-zero when the
posture is weaker than what the product promises.

## Decision: two providers behind one interface

`AiProvider` has `rewrite()` and `extractAgreements()`. The `mock` provider is
rule-based (removes a list of blaming constructions, un-shouts ALL CAPS, calms
punctuation) and runs the identical guard. It exists so the app is fully runnable
with no credentials and so tests never depend on a model's mood. The composer
labels it as offline demo mode, because presenting rules as AI would be a lie.

## Prompt design notes

Kept in `src/lib/ai/prompts.ts` as reviewed surface. Structure: what to keep
(facts, request, boundary, voice), what to remove (insults, blame, absolutes,
history-raking, shouting), what never to do (add facts, give legal or parenting
advice, comment on character, soften a threat). Refusals are explicit because a
general model drifts into advice when the topic is children.

## Edge cases

| Case | Behaviour |
| --- | --- |
| Already calm | `unchanged` — no fake improvement |
| Model returns prose around the JSON | Tolerant extraction, then Zod |
| Model returns an empty suggestion | Fails Zod → `unavailable` |
| Suggestion identical to input | `unchanged` |
| Message over 4000 characters | Rejected before the model call |
| "The kids are killing me" | Not a threat; the screen requires a target |
| Threat phrased as "I will" not "I'll" | Both forms covered; test enforces it |

## Test plan

- 9 unit tests on fact extraction and comparison, including the near-misses.
- 5 unit tests on the risk screen, including false-positive protection.
- End-to-end: a hostile message with four facts; assert the facts survive, the
  ammunition does not, and that a threat is refused while sending stays enabled.
