# TASKS — checklist (post-build)

Phases from CLAUDE.md. Boxes reflect the 2026-08-08 build pass.
User is doing full manual QA — automated test runs were skipped during this build.

---

## Phase 0 — compile & log in

- [x] install / infra / migrate / seed
- [x] Auth.js login wired
- [x] Stub exports that blocked the app (intern portfolio, resend welcome, incorp generate, supabase client types)
- [ ] Manual: log in as seeded manager → dashboard (your QA)

## Phase 1 — data surface

- [x] Port API routes; delete `_reference-supabase/`
- [x] Repositories: engagements, profiles, KB, audit, board-resolution, documents, compliance
- [x] Storage via `src/storage/s3.ts` + board-resolution / incorp helpers
- [x] Hooks: intern portfolio; realtime → poll/no-op
- [ ] Manual: full engagement flow manager + client on Postgres + MinIO

## Phase 2 — localStorage last mile

- [x] Repos + APIs for tasks, requests, invites, activity, notifications
- [x] AppContext loads via TanStack Query when signed in
- [ ] Manual: clear browser storage, confirm work persists

## Phase 3 — jobs & email

- [x] `compliance-generate` Inngest job + compliance repository
- [x] Shared Resend helper (`send-resend.ts`); console skip when no API key
- [ ] Manual: `npm run inngest:dev` + confirm cron/log

## Phase 4 — pilot

- [x] `npm run start:lan` script
- [ ] Manual: build + LAN walkthrough as manager / intern / client

## Four-role (admin / manager / intern / client)

- [x] Schema: `trak_role` + `admin`; `engagements.manager_id`; `profiles.reports_to_manager_id`
- [x] Auth / middleware / seed: four roles; homes `/app/admin` + `/app/manager`
- [x] Move former manager UI to `/app/manager/*`; thin firm admin shell under `/app/admin/*`
- [x] Repository scoping: admin unrestricted; manager by `manager_id` (+ legacy `admin_id`)
- [x] API guards: `requireAdmin` / `requireManager` / `requireAdminOrManager`
- [x] Firm Admin: dashboard, People (`/api/admin/people`), firm projects, Approvals
- [x] Project create: Admin assigns `managerId`; PM creates as self
- [x] Approvals inbox + `project-stuck` helper; Pre/Post primary queues
- [ ] Manual QA: log in as all four demo users and walk firm / PM / lead / client flows

## Stage 2 — AWS (later)

- [ ] Follow `docs/context/AWS-DEPLOY.md` (billing alarm → RDS → S3 → container → env swap → migrate)
- [ ] Add `Dockerfile` + finish `infra/app.tf` / VPC wiring when ready for IaC
- [ ] Keep Resend on first AWS deploy; SES flip via `EMAIL_PROVIDER=ses` when ready (adapter already in tree)
- [ ] Finish remaining `infra/*.tf` + remote state backend

## Invariants

1. Only repositories import `db`.
2. Every repo takes `AuthContext` and scopes by role.
3. Do not edit LIFTed domain code unless a test fails.
4. No Supabase / no hardcoded endpoints.
