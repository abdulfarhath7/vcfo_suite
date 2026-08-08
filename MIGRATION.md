# MIGRATION.md — SBC-Track (Supabase) → VCFO Suite (AWS-target)

The map of what came across, what must be rewritten, and what was dropped.
Original repo referenced as `../SBC-Track-main/`.

## Stack change

| Concern | Was (SBC-Track) | Now (VCFO Suite) |
|---|---|---|
| Framework | Next.js 16 / React 19 / TS | **unchanged** |
| DB | Supabase Postgres | Postgres via **Drizzle** (local Docker → RDS) |
| Auth | Supabase Auth | **Auth.js** (Credentials; SSO later) |
| Access control | Postgres **RLS** policies | **Path A**: repository-layer scoping |
| Storage | Supabase Storage | **S3** (local **MinIO** → AWS S3) |
| Realtime | Supabase Realtime | **dropped** for pilot; TanStack Query polling |
| Jobs | none (localStorage cache) | **Inngest** |
| Email | 2 systems | 1 DB-backed system; **Resend** sender |
| UI / domain / tests | — | **unchanged (LIFTed)** |

## 🟢 LIFTed (copied as-is)

| Original | Now |
|---|---|
| `src/data/checklist.ts`, `compliance.ts`, `engagements.ts`, `vault.ts` | `src/data/` |
| `src/lib/checklist-*.ts` (+ tests) | `src/domain/` |
| `src/lib/board-resolution*.ts` (pure) | `src/domain/` |
| `src/lib/dir-2*.ts` (pure) | `src/domain/` |
| `src/lib/compliance/{fy-periods,generate-instances,extract-triggers,obligations-seed,types}.ts` | `src/domain/compliance/` |
| `src/lib/incorporation-docs/*` (pure) | `src/domain/incorporation-docs/` |
| `src/lib/api/schemas.ts`, `engagement-schemas.ts` | `src/domain/` |
| `src/components/**` (minus `layout/`) | `src/components/` |
| `src/views/**` | `src/views/` |
| `src/hooks/**` | `src/hooks/` |
| `app/app/**` UI page shells | `app/app/` |
| all `*.test.ts` (44) | alongside their modules |

## 🟡 REWRITE (same behavior, new backend)

| Original | Now / action |
|---|---|
| `src/lib/engagements-db.ts` (takes SupabaseClient) | `src/db/repositories/engagements.ts` (Drizzle) ✅ reference done |
| `src/lib/api/require-manager.ts`, `require-role.ts` | `src/auth/guards.ts` ✅ done (same interface) |
| `src/lib/supabase/{client,server,admin}.ts` | `src/db/client.ts` + `src/auth/config.ts` ✅ |
| `src/lib/supabase/use-*realtime*.ts` | drop for pilot; polling via TanStack Query |
| `src/lib/*-storage.ts` (board-res, dir-2, milestone, kb) | rewrite over `src/storage/s3.ts` → `src/db/repositories/` |
| `src/lib/incorporation-docs/{storage,preview-save,share}.ts` | stashed in `src/db/repositories/_rewrite-from-supabase/` |
| `src/lib/compliance/compliance-store.ts` (localStorage) | `engagement_compliance_triggers` table + repo + Inngest |
| `src/lib/audit-log.ts` (Supabase writes) | `auditEvents` repository |
| `src/context/use-app-provider-value.ts` (localStorage seeds) | TanStack Query hooks → API → repositories |
| `supabase/functions/create-client-engagement` (edge fn) | Next.js route (runs on App Runner) |
| the **18 API routes** below | port from `app/api/_reference-supabase/` |

### API routes to port (18)
```
admin/audit-logs                          knowledge-bank
admin/interns                             knowledge-bank/[id]
engagements/[id]/board-resolution/download          knowledge-bank/[id]/download
engagements/[id]/board-resolution/download-signed   resend-welcome-email
engagements/[id]/board-resolution/generate          send-welcome-email
engagements/[id]/board-resolution/status
engagements/[id]/board-resolution/upload-signed
engagements/[id]/dir-2/download
engagements/[id]/dir-2/generate
engagements/[id]/incorporation-docs/download
engagements/[id]/incorporation-docs/generate
engagements/[id]/incorporation-docs/share
engagements/[id]/progress-cc
```
Template: `app/api/engagements/route.ts`. Delete `_reference-supabase/` when done.

## 🔴 DROPPED

| Dropped | Why |
|---|---|
| `src/lib/supabase/**` | Replaced by Drizzle + Auth.js |
| `src/lib/email/*.ts` (hard-coded templates) | Keep only the DB-backed system |
| `src/components/layout/*` | Superseded by `shell/` |
| Demo auth (`NEXT_PUBLIC_ENABLE_DEMO_AUTH`, mock invite) | Not for production |
| `src/data/mockData.ts`, seed constants | Replaced by `scripts/seed.ts` |
| `src/lib/legacy-engagement-ids.ts` | Fresh DB has no legacy e1–e3 ids |
| `supabase/` dir | Migrations become the SPEC (below), not runtime |
| `temp-dir2-unzip/`, `playwright-report/`, `test-results/` | Build/scratch artifacts |

## RLS policies = the access-control SPEC (Path A)

The original enforced isolation in Postgres. We moved it to repositories. The
policies below are the exact rules each repository query MUST reproduce. Source:
`../SBC-Track-main/supabase/migrations/20260522120000_engagements_and_rls.sql`.

| Entity | Manager | Intern | Client |
|---|---|---|---|
| engagements | all | `intern_id = ctx.internId` | `client_user_id = ctx.userId OR client_id = ctx.clientId` |
| checklist_state update | all | assigned engagements | own engagement, **checklist_state column only** (was a column-guard trigger) |
| documents / milestone docs | all | via assigned engagement | via own engagement + `shared_with_client` |
| knowledge_bank_files | all | role ∈ `visible_to_roles` | none unless shared |
| compliance_* | all | via assigned engagement | read-only via own engagement |
| audit_events | all | via assigned engagement | none |

> When implementing a repository, open the matching migration in
> `../SBC-Track-main/supabase/migrations/` and translate the `USING (...)` /
> `WITH CHECK (...)` clauses into Drizzle `where` conditions. Add a test that a
> tenant-B row is invisible to a tenant-A client/intern.
