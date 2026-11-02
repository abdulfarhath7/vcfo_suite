---
description: Start a new feature with the house checklist
argument-hint: [short description of the feature]
---

Before writing code for a new feature:

1. Read `CLAUDE.md` (golden rules and conventions), `docs/context/STATE.md` and `docs/STATUS.md`.
2. Open `docs/context/HOW-TO-BUILD.md` and pick the recipes this feature needs (staff page,
   client-portal page, API route, repository method, DB column, Inngest job, notification, UI,
   tests, deploy). Follow the files and commands listed there.
3. Check the relevant `docs/context/notes/<area>.md` for gotchas.
4. Keep to the golden rules: only `src/db/repositories/*` imports `db`; every repository function
   takes an `AuthContext` and scopes by role with a cross-tenant test; email first, WhatsApp only
   as an additive nudge; tokens and `DashHero` / `DashSection` / `IconChip` / `button-variants`
   for UI; never edit `src/components/client-portal/css/` (edit `css-src/`).
5. Plan the change as a short list of files, then build it, then run `npm run check`.
6. When done, update `docs/context/STATE.md` and append any gotcha to the area note. Do not commit.

The feature to build: $ARGUMENTS

If no feature was given above, ask what the feature is, who uses it (which roles) and where it
should appear, before doing anything else.
