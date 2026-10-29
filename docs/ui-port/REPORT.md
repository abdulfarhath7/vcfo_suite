# UI port report: VCFO Spectrum (29 Oct 2026)

Branch `ui/spectrum`, pushed to `origin`. Not merged, not deployed. No migration, no seed and
no SQL were run, and no dependency was added. The prototype source is `design/spectrum`
(05e5509) of `abdulfarhath7/vcfo-prototype`, read from a clone at `~/Documents/vcfo-prototype-ref`.

## How to run it and see it

```bash
git switch ui/spectrum
npm run infra:up && npm run db:migrate && npm run db:seed-demo   # local Docker only
npm run dev                                                        # http://localhost:3000
```

`npm run dev` and `npm run build` regenerate the client portal CSS (`css/` is gitignored).
Demo logins are in `README.md`. Check each portal in light, dark and at 390px width; no browser
check was made tonight (D-14).

Gate at the last commit: `npm run typecheck` 0 errors, `npm run lint` 0 errors (329 warnings,
mostly `react-refresh/only-export-components`), `npm run test` 287 files and 2841 tests pass, and
`npm run build` succeeds. The e2e smoke list (`e2e/smoke.spec.ts`) has the new routes but was not run.

## Second pass (29 Oct 2026): every gap, and the prototype's newer commits

The owner asked for every gap to be built and for the prototype's five newer commits
(05e5509 to ccb6ae4, the parity pass in its `docs/SPECTRUM-PARITY.md`) to be ported.

- **Migration first.** `src/db/migrations/0026_gaps_backend.sql` adds every table and column the
  gaps need, and the `developer` role. It was applied to the local Docker database only. Apply it
  on RDS before deploying this branch. `docs/ui-port/GAPS.md` lists what was built for each gap
  and what is left.
- **New dependencies:** `@aws-sdk/client-apprunner`, `@aws-sdk/client-cloudwatch-logs`,
  `@aws-sdk/client-cost-explorer` (developer console). Only those three lines of `package.json`
  were committed; your own edits there are still uncommitted.
- **New env names** are in `.env.example`: `APP_LOG_GROUP`, `APP_RUNNER_SERVICE_ARN`,
  `AWS_COST_EXPLORER`, `INNGEST_SIGNING_KEY`, `INNGEST_API_BASE_URL`, `DEMO_REQUEST_TO`,
  `WHATSAPP_TEMPLATE_NAME_CLIENT_REMINDER`.
- **Not run:** `scripts/backfill-step-events.mjs` (dry run by default, `--apply` writes) seeds step
  history from audit events, so days in step have a past.
- **Security fixes found on the way:** `/api/audit-logs` returned every staff action on a
  client's engagement to that client; it now applies the client allowlist. Staff could not mark a
  filing filed at all; `PATCH /api/filings/:id/status` now does it, scoped and audited.

| Area | What changed | Commit |
|---|---|---|
| Developer console | `developer` role, nine read-only screens, masked client data | 6c07b40, 441b0af |
| Super admin | Firm settings, admins and escalations, assign and reassign, Growth pipeline, saved and scheduled PDF reports, Book a demo | 290b73c, ff4842d |
| Security | Two-step sign-in (TOTP), device sessions and sign-out, staff notification preferences | 62ac1a4 |
| Client portal | Proof upload, DINs, withdraw, multi-file upload, Message the lead, sub-step progress | e259bbe |
| Work | Task drawer sessions, checklist, files, activity, Mark done; planner; client messages and triage; assign; Remind; reassign | 70f3338, f26603e |
| Records and compliance | Obligation texts, renewals, certificates, record tabs, notes; step events, metrics, audit cursor; Mark filed | 556eaaf, e71d89e, b2a5edd |
| Mail and vault | Signature, attachments, mail groups; vault ZIP, upload, requests, review, preview | 5373af9 |
| Shared parts (parity) | Compact home card, FilterChip, DangerConfirm, toasts, L1 loading, menu keys, Term and Tip, AvatarStack, bulk bar, status menu, saved views, density, new-since, relative due words, six-word chips, ShortcutSheet, phone TabBar | a2d4de6, 8bdadcc |
| Screens (parity) | Compact homes on every portal, Team tasks, Work and Clients tables, Filings by filing and client, client home upload progress, retaken landing screenshots | 787eb9e, 8b8ecbf, 3b755e1 |
| Prototype 65f70b7 (D-17, M-27 to M-30) | H3 tight home card with the scope switch inside, trend lines where the past can be rebuilt, row menus with E, A and C keys, green A1 toasts, landing gap, phone home card | 92a5034, fc0e7c8 |
| Follow-ups | Mark filed; client audit allowlist; only the super admin removes a super admin or developer; Message and Dates bell kinds; Remind me uses firm reminder days; weekly digest (Mondays 09:00) | b2a5edd, d03bb7c, 5063792, 522433e, 7e70e9b |

## Done

| Area | Portal | Status | Commit |
|---|---|---|---|
| Tokens (light and dark), Roboto, 6px radius, no card shadows | All | Done | e60fd08 |
| Shell: navy 248px sidebar, blurple picked row, 60px top bar, 380px search, 3px ribbon, Ask VCFO sidebar button with "/" | Staff and client | Done | e60fd08 |
| Buttons, chips, owner chips, area pills, inputs, tabs, overlays, T1 tables, home card | All | Done | e60fd08, d9ae5ed, 3bf5e3a |
| ST5 marks and phase bar, file badges, empty and loading states | All | Done | d9ae5ed |
| Home: wash card, ST5 steps, Gantt, attention lists, status bar, IDs, area, registrations; one responsive board for phone | Client | Restyled | 3a800fd |
| Incorporation landing, phase, step (underline tabs), board resolution | Client | Restyled | 3a800fd |
| Calendar, Filings | Client | Restyled | cc8ddd2 |
| Obligations list and record | Client | Built | cc8ddd2 |
| Registrations list and record | Client | Built | cc8ddd2 |
| Top bar, Documents, upload, viewer, Library and reader, Credentials, Announcements, Notifications, Audit | Client | Restyled | bda42bb |
| Profile with the Team section (C-0027); Team route kept | Client | Built | bda42bb, 1fe1e13 |
| Today: home card, All / Incorporating / Compliance switch, action queue, phase progress, overdue filings | Lead | Restyled | 19f08e8 |
| Today board: team tasks with filter chips and List/Board, approvals, task status donut, workload by lead | Manager | Restyled and built | 19f08e8 |
| Today: clients grid, phase progress, managers, Needs your decision | Admin | Restyled and built | 19f08e8 |
| Work (list, board, 14-day Gantt) and the task drawer | Lead | Restyled and built | 3ca836e |
| Clients, projects, recycle bin, leads, people, managers | Lead, manager, admin | Restyled | 3ca836e |
| Client record (plain head, underline tabs, ST5 in place), step page, forms, doc pack, board resolution editor | Lead, manager, admin | Restyled | 3ca836e |
| Calendar, Filings | Lead, manager, admin | Restyled | 544194e |
| Obligations grouped by filing, and the obligation record | Lead, manager, admin | Built | 544194e |
| Registrations list and item | Lead, manager, admin | Built | 544194e |
| Email, Vault (K-39 explorer), Knowledge bank, Announcements, Notifications, Analytics, Audit, Approvals, Profile, Ask VCFO panel, Ask sources and gaps | Lead, manager, admin | Restyled | 1c3bb6f, (PageHeader) |
| Overview, Clients, client record | Super admin | Restyled | 56ea431 |
| Risks, Practice · Incorporation, Practice · Registrations, Team, Growth, Reports | Super admin | Built | 56ea431 |
| Sidebar in the prototype's order with the new pages | Super admin | Done | (after 56ea431) |
| Obligations first under Compliances (R-33); Registrations item | Every sidebar | Done | d460e21 |
| Landing: v6 navy landing with the comparison section (C-0111, C-0112) | Public | Restyled | 570f099 |
| Sign in: Spectrum card on navy, real Auth.js flow | Public | Restyled | 570f099 |

Nothing shown on a screen is sample data. Where the prototype shows a number the data cannot
give, the screen leaves it out and `GAPS.md` lists it.

## Not done

| Item | Next step |
|---|---|
| Browser check of every screen, light, dark and 390px | The owner's test pass. Then fix by screen. |
| e2e suites (`npm run e2e:smoke`, `npm run e2e`) | Run after `db:seed-demo`. Text checks that changed: the settings heading is "Sign-in and security"; Library's head reads "{company}’s library". |
| Developer console (9 screens) | Gap G-01: needs a developer role and data sources. |
| Firm settings (admin and super admin) | Gap G-02: needs a firm settings store. |
| Trend lines on lead, manager and admin homes | Their tiles count step states, stages and windows, which keep no history. They need `tasks.completed_at`, review status in step events, stage and schedule change events and a fulfilled time on document requests; then `src/db/repositories/home-trends.ts` can add them. |
| Shared menu parts | `DropdownMenuSubTrigger` has no `shortcut` prop, letter keys in a submenu reach the parent menu, and `EFilingGrid`'s row-actions column fits three buttons. |
| Old client phone home files | `MobileHome.tsx` and the files around it are no longer imported; retire them with the list below. |
| `src/lib/email/email-layout.ts` | Still its own palette. |
| Old UI files no longer used by any route | Kept, not deleted (rule 5 of `new_context.md`). Retire after the owner's test: `src/components/client-portal/pages/home/{MobileHome,MobileCardsA,MobileCardsB,MobileParts,useMobileHome}.tsx`, `css-src/home-m.css`, `css-src/incorporation-landing.css`, `CrBot.tsx`, `Visor.tsx` figures, `src/views/auth/Login.tsx`, `src/components/auth/{LoginHero,LoginShowcase}.tsx`, `react-bits/BlurText.tsx`, `src/components/marketing/sections/{LandingHero,LandingImpact,LandingProblem,LandingHowItWorks}.tsx`, `HeroProductPlane.tsx`, `src/components/intern/LeadPracticeStrip.tsx` (keep `isOverdueOrDueSoon`), CSS classes `.lead-tl*`, `.lead-board-col*`, `.ann-kind*`, `.notif-kind`, `.lead-hero*` in `app/globals.css`, `DOC_STATUS_*_TONE` in `src/lib/doc-pack/labels.ts`. |

## Gaps

`GAPS.md` lists 30 features that need backend work (G-01 to G-30). The largest are the
developer console, firm settings, per-step opened and due dates (stage durations, expected COI,
time in step), a filed-against-due history (on-time rates), a step reminder endpoint, client
proof upload, and the vault upload and zip routes.

## Decisions I made alone

`DECISIONS.md` holds D-01 to D-15. The ones to look at first:

- D-01: the branch starts from `port/carryover-1`, because `main` lacks 55 commits of your work.
- D-04, D-05: `brand` is blurple; `navy-fill` is the Spectrum "strong" colour that flips in dark mode; the sidebar uses `side`.
- D-07: "Waiting" is teal, "Due soon" amber; old `solid-waiting` chips are now teal.
- D-11: the client portal's floating launcher and Visor figure are hidden; Ask VCFO opens from the sidebar or "/".

The screen agents also chose, and each is easy to reverse:

- Status words follow R-13's six words everywhere. Filed reads Done and upcoming reads Not started. "Sent back" stays as its own word.
- Lead Today has an All / Incorporating / Compliance switch. "Incorporating" means not yet incorporated.
- Team tasks come from the same items each lead sees on Work (steps, filings, document requests), not from the `tasks` table, which has no titles.
- "Waiting on client" for a filing means: not filed, no data-received date, and late or due within 15 days. If staff never record data-received dates, every such filing shows as waiting.
- "Stuck" means open work with no update for 14 days, or a blocked reason.
- Company tiles on staff screens are neutral, following the Suite's no-identity-colour rule. The super admin client tiles take a colour from a hash of the engagement id, because no identity colour is stored.
- `INTERN_PHASE_TABS_ENABLED` is now `true`, so the lead record shows the phase track and steps in place (R-36).
- Back buttons are gone from the staff record, step, doc pack and board resolution pages (R-09). They stay on the client step route.
- The client sidebar's Settings item reads "Profile". Team is a tab inside Profile (`settings#team`).
- Landing: "Book a demo" goes to `/contact`; "Try it live" goes to `/login` and may need new words.
- Profile shows every section on one page with anchor links, so `#appearance`, the Outlook return and the e2e check keep working.
- The super admin sidebar puts the new pages first (Overview, Risks, Clients, Practice areas, Team, Growth, Reports, Updates). Firm, People, Email, Firm log, Portal, Client log and Firm settings sit below the break.

## Untracked files left alone

Your own uncommitted edits were not touched or committed: `docker-compose.yml`, `package.json`,
`docs/specs/landing-page/README.md`, `docs/overview/*`, `docs/specs/landing-page/lovable/`,
`scripts/build-incorp-docs-er*.mjs` and `new_context.md`.
