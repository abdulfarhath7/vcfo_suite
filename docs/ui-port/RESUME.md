# Where the Spectrum diff work stopped (29 Oct 2026, about 23:40)

Branch `ui/spectrum`, pushed to origin. Nothing is merged to `main` and nothing is deployed.

## Done and committed

- Every area of `docs/ui-port/PROTOTYPE-DIFF.md` went through the fix rounds. Per-row results and
  reasons are in `docs/ui-port/fixes/fix-*.md`. Totals at the last count: 1829 ✓, 739 ◐, 182 ✗ of
  2750; later rounds closed more rows than those totals show.
- Migration `0028_schema_needs` (applied locally, not on RDS) and its wiring: designation and
  membership number, reminder days, digest time, role alerts, sent to client, assigned by, step
  holder, per-field review, filing thread, before-filing lists, KPI snapshots.
- New jobs: `kpi-snapshots`, `daily-digest`, `staff-alerts`, registered in `app/api/inngest/route.ts`.
- Developer Profile at `/app/dev/profile` (owner decision D-16).
- Owner decisions D-16 to D-21 are in `DECISIONS.md`.

## Stopped half-way (uncommitted, unchecked, left in the working tree)

1. Staff Today and Work: planner Day and Month views, all-day row, drag and resize of time blocks,
   Plan my week grid, Remove lead, a lead's calendar on their page (S-182, S-186, S-190, S-207 to
   S-209, S-364, S-372), and assigned_by in `ask-handoff.ts` and `client-change-requests.ts`.
   Files: `app/api/work/time-blocks/route.ts`, `src/components/work/use-work.ts`,
   `src/db/repositories/{time-blocks,ask-handoff,client-change-requests}.ts`,
   `src/lib/metrics/trend-stamps.ts` and tests.
2. Client home: "Waiting on" and "With SBC" trend lines from `engagement_step_events.holder`.
   Files: `src/db/repositories/home-trends.ts`, `src/lib/metrics/client-holder-trend.ts`,
   `src/components/client-portal/pages/home/{CardsA.tsx,derive.ts}` and tests.

Check them with `git diff` and `npm run check` before keeping them.

## Still to do

- Finish items 1 and 2 above, then `npm run check`.
- Full browser smoke on a fresh server: `npm run dev`, then `npm run e2e:smoke`. Earlier runs
  failed only because the dev server stopped while agents edited files.
- Update the totals in `PROTOTYPE-DIFF.md` from `docs/ui-port/fixes/`.
- Not built: staff upload of a signed board resolution (S-574), the Teams channel (S-654),
  MCA notices, DSC or KYC expiry, VCFO Assist state.
- Before any deploy: apply migrations 0027 and 0028 on RDS, and set `CREDENTIALS_ENCRYPTION_KEY`
  on App Runner.
