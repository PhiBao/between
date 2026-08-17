---
inclusion: always
---

# Between — technology steering

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript strict**
  (`noUncheckedIndexedAccess` on). Server Components by default; client
  components only where interaction demands it.
- **pnpm** with exact pinned versions. No caret ranges.
- **Supabase Postgres + Auth**. Row Level Security is the authorization boundary.
- **Tailwind v4** via `@tailwindcss/postcss`, plus a small hand-written component
  layer in `globals.css`. No UI kit.
- **Amazon Bedrock** through the `bedrock-mantle` endpoint (OpenAI-compatible
  Chat Completions, Bedrock API key, no IAM signing).
- **pdf-lib** for the evidence pack. No headless browser, no native binaries.
- **Vitest** for units, **Playwright** for end-to-end.

## Rules that keep the stack honest

1. **No new dependency without a reason written in the PR or commit.** The list
   above is close to the whole list. Prefer 30 lines of our code to a package.
2. **All data access is server-side.** The browser gets a Supabase client for
   nothing but auth. No service-role key in any user request path — it is limited
   to `scripts/` and the scheduled job.
3. **The AI layer is an interface with two implementations**
   (`mantle`, deterministic `mock`). The app must run and be fully testable with
   no API key and no network. The mock is rule-based and the UI labels it as
   offline demo mode — it is never presented as model output.
4. **Never trust model output.** Parse with Zod, then apply the fact-preservation
   guard and risk screen. If validation fails, degrade to "kept as written".
   Never block the user from sending.
5. **`store: false` on every model request**, and prefer a model whose
   `allowed_modes` include `none`. `pnpm check:retention` verifies this.
6. **Never log message bodies.** Not in errors, not in AI failure paths, not in
   analytics. `ai_events` stores counters only.
7. **Every schema change is a migration file** in `supabase/migrations/`, applied
   with `supabase db push`. No manual dashboard edits.
8. **Time is UTC end to end.** Hashes depend on exact timestamp formatting; see
   `src/lib/record/hash.ts` and `public.entry_canonical` in the first migration —
   they must stay byte-identical.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Local development |
| `pnpm verify` | typecheck + lint + unit tests (run before every commit) |
| `pnpm test` | Unit tests |
| `pnpm e2e` | Playwright, two-parent flow |
| `pnpm db:push` | Apply migrations to the linked project |
| `pnpm seed` | Rebuild the demo record |
| `pnpm check:retention` | Verify Bedrock data-retention posture |
