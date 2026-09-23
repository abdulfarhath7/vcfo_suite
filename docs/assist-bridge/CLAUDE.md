# CLAUDE.md — Assist profile export (VCFO Suite side)

**Read this file, then every file in `docs/` in numerical order. Ignore any other
context, briefing or phase document in this repository.** This repo contains other
context packs for unrelated work; they are not part of this task.

## What this task is

VCFO Suite holds engagement data in `engagements.checklist_state`. A separate Chrome
extension, VCFO Assist, fills MCA SPICe+ forms from a JSON "profile" that is currently
**pasted by hand**. Nothing carries Suite's data to it.

You are building the Suite half of that path: a pure mapping module, a read-only API
route, and one staff UI control. The extension is a different repository and is not
your concern.

## Scope — the whole task

| Build | Do not build |
|---|---|
| `src/lib/assist-profile/{types,vocabulary,build}.ts` + tests | Anything in the extension |
| `src/lib/api/assist-profile.ts` | Any new table or migration |
| `app/api/engagements/[id]/assist-profile/route.ts` | Any checklist step, gate, email or board-resolution change |
| A "Copy for Assist" control on Pre-4 and Pre-10 | Any write path — this feature only reads |

## Hard rules

1. **Reuse Suite's existing resolvers.** Never read `checklist_state` directly.
   `resolveProposedCompanyName`, `resolveRegisteredOfficeResponses`,
   `proposed-directors.ts`, `resolveParentEntityName/Address` and
   `buildDocPackContext` already exist and are tested. Re-deriving a field is how the
   docx generators and Assist drift apart.
2. **The mapping module is pure.** No `db`, no S3, no React, no `fetch`. It takes a
   context object and returns a profile. Only `src/db/repositories/*` may import `db`.
3. **Tests are required.** This is a tested production codebase. Follow the pattern
   beside `src/lib/doc-pack/*.test.ts`. Verify with
   `npm run typecheck && npm run test` after every phase.
4. **No new tables, no migration.**
5. **MCA vocabulary lives in one file** — `vocabulary.ts` — commented as MCA's
   vocabulary, not Suite's.
6. **Omission, not invention.** A field Suite does not hold is left out of the profile
   and listed in `missing`. Never a placeholder, never a guess.
7. **`mcaLogin.userId` is always empty.** Suite never emits an MCA credential.

## How to work

- Build P1, P2 and P3 from `docs/04-phases.md` in one run. Do not stop to ask.
- Append to `TASKS.md` after each phase.
- Judgement calls go to `QUESTIONS.md` with your default and the alternative. Keep
  going.

## Style

TypeScript, matching the file layout and naming already used in `src/lib/doc-pack/`.
