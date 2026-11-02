# Brief: statutory and non-statutory Compliances (30 Oct 2026)

Source of truth: the prototype's `docs/COMPLIANCE-MODEL.md` at main e86ce88, in the read-only clone
`/home/farhath/Documents/vcfo-prototype-ref` (never edit it). Its screens: `src/screens/staff/{ObligationsScreen,ns-parts,CalendarScreen,FilingsScreen,ObligationScreen,register-parts}.tsx`,
`src/screens/shared/{StatDetail,TaskDetail,detail-parts}.tsx`, `src/screens/client/{ObligationsScreen,ObligationScreen,CalendarScreen,FilingsScreen}.tsx`,
`src/screens/super/{FilingsScreen,PracticeCalendar}.tsx`, `src/components/ui/TaskMarks.tsx`, `src/components/cards/{CalendarBar,CalendarRail,MonthCalendar}.tsx`.
Rules: the prototype's `docs/RULES.md` (R-01 to R-50). Also read `docs/ui-port/AGENT-BRIEF.md` and the project `CLAUDE.md`.

## Split

- **Data agent** owns the schema, the seed, repositories, routes, the reminder job, and
  `docs/ui-port/COMPLIANCE-API.md`. It writes that API file FIRST (within its first steps), then builds.
- **Staff screens agent** owns the staff and super admin Obligations, task table, New task dialog,
  statutory detail page, non-statutory detail page, Calendar and Filings filters
  (`src/views/compliances/*`, `src/components/compliances/*`, staff and super routes under `app/app/*`).
- **Client screens agent** owns the client Obligations (both categories), the client detail pages and
  the client Calendar and Filings filters (`src/components/client-portal/pages/compliances/*`,
  `pages/registrations/*` only if needed, client routes, css-src then `node scripts/cp-css.mjs`).
- Screen agents read `docs/ui-port/COMPLIANCE-API.md` and call only those routes. Until a route
  exists, build the screen against the contract and test it with mocked fetches.

## Rules

1. The activity master (`src/data/activity-master.ts`, 43 rows from the owner's two documents) is
   real data: seed it into a table. The prototype's `compliance-tasks.ts` occurrences are SAMPLE
   data: never copy them. Real statutory occurrences are the existing `compliance_instances`; link
   each to its activity. Non-statutory tasks are created by admins and managers through New task.
2. Keep the spec's rules in sections 3 and 7: six status words (R-13) mapped from the eight stages,
   urgency, visibility (firm, client, both; statutory is always both), the six reminders, roles
   (3.5), no reminder without entity, owner and dates (DR-22), bell only (R-38).
3. Schema: the data agent edits `src/db/schema*.ts` by Edit only and does NOT run db:generate or
   db:migrate. The hub writes migration 0030 (additive only) and applies it locally.
4. Every repository takes an AuthContext, scopes by role, and has a cross-tenant test. A client sees
   only its own engagement and only tasks with visibility client or both.
5. Keep every existing feature (the Statutory view, FY stepper, Overdue tile, filings register,
   proof, VCFO Assist, Before filing lists, filing thread). The new Statutory detail page reuses
   the existing obligation record parts where they match.
6. No sample numbers, no dependencies, no git, no sub-agents. Other agents work at the same time:
   edit only your files.
7. Report to `docs/ui-port/fixes/compliance-<area>.md`: spec item (S-1 … K-2, D-1 … D-4, C-1 … C-4,
   F-1 … F-3, DR-01 … DR-22) | status | what you did. Then files, routes, schema, decisions.
8. Finish with `npx tsc --noEmit -p .`, vitest near your files, eslint with 0 errors.
