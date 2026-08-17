---
inclusion: always
---

# Between — structure steering

```
src/
  app/
    actions.ts            all record write actions (server actions)
    auth-actions.ts       sign in / up / out, server-side so cookies land
                          on the same response as the redirect
    page.tsx              landing (redirects signed-in users)
    start/                onboarding: name + children, then straight to value
    join/[token]/         accepting an invite
    record/               the thread (main surface)
    agreements/           what was agreed and who owes an answer
    pack/                 evidence pack summary
    pack/download/        route handler streaming the PDF
    verify/               public integrity check (page + its own action)
    api/jobs/tick/        scheduled job, shared-secret authenticated
  components/             presentational + interactive UI, no data access
  lib/
    ai/                   provider interface, mantle client, mock, prompts
    record/               hash chain, append, queries
    safety/               fact preservation, risk screen
    pack/                 pack assembly and PDF rendering
    supabase/             server / browser / admin clients
    env.ts                validated configuration
    types.ts              shared domain types
supabase/migrations/      schema, RLS, and the operations that must be atomic
scripts/                  seed, retention check, hook helpers
e2e/                      Playwright specs
```

## Conventions

- **Where logic lives.** Rules that must hold regardless of client live in the
  database (RLS, triggers, security-definer functions). Rules about presentation
  live in components. `lib/` holds pure, testable logic; put anything worth a
  unit test there rather than in a component or an action.
- **Server actions are thin.** Authenticate, validate with Zod, delegate, revalidate.
- **No data access in `components/`.** Pages load data and pass it down.
- **Naming.** Files kebab-case. Types PascalCase. Functions and variables
  camelCase. Database columns snake_case, mapped at the query boundary.
- **Comments explain why.** Do not narrate what the next line does; record the
  decision, the constraint, or the threat being defended against.
- **Tests sit beside their subject** (`hash.ts` / `hash.test.ts`).
- **User-facing copy is plain and unemotional.** Say "That is not what we agreed",
  not "Reject". Never scold, never congratulate.
