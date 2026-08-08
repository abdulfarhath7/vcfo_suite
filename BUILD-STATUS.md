# BUILD-STATUS.md — what's done, what's stubbed

Honest state of the scaffold. It was generated **without a network**, so it has
not been through `npm install` / `tsc` / tests. Treat this as a well-structured
starting point, not a finished build. Claude Code finishes it per `CLAUDE.md`.

## ✅ Done (real code)

- **Project scaffold**: `package.json` (AWS-target deps, Supabase removed),
  `docker-compose.yml` (Postgres + MinIO), `.env.example`, `drizzle.config.ts`,
  `tsconfig` path alias `@/* → src/*`, `.gitignore`.
- **The seam**: `src/db/client.ts` (Drizzle), `src/db/schema.ts` (all tables
  ported from the 29 migrations + the new localStorage-replacement tables),
  `src/db/repositories/engagements.ts` (reference impl with Path A scoping).
- **Auth**: `src/auth/config.ts` (Auth.js Credentials), `src/auth/guards.ts`
  (`requireManager`/`requireRole` with the original interface),
  `app/api/auth/[...nextauth]/route.ts`, `middleware.ts` (role routing).
- **Storage**: `src/storage/s3.ts` (MinIO local / S3 on AWS, same code).
- **Jobs**: `src/jobs/` (Inngest client + compliance job stub + serve route).
- **Example ported route**: `app/api/engagements/route.ts` (the template).
- **Seed**: `scripts/seed.ts` (demo manager/intern/client + engagement).
- **Infra**: `infra/*.tf` starter (RDS Mumbai, S3+KMS, App Runner placeholder).
- **LIFTed unchanged**: ~113 files in `src/lib/` (checklist, validation, docx,
  compliance math, api helpers), `src/data/`, `src/components/` (174),
  `src/views/` (65), `src/hooks/`, and all their tests.

## 🟡 Stubbed — implement in Claude Code

All stubs `throw` on import with a message pointing to the original file, so
you can't accidentally ship them and you get a clear worklist by running the app.

**Repositories / storage (Phase 1)** — rewrite over Drizzle + S3:
`engagements-db.ts`*, `audit-log.ts`, `board-resolution-storage.ts`,
`dir-2-storage.ts`, `knowledge-bank-storage.ts`, `milestone-document-storage.ts`,
`incorporation-docs/{storage,preview-save,share}.ts`,
`api/{board-resolution-access,board-resolution-generate,engagement-progress-cc-access,incorporation-docs-generate}.ts`,
`create-intern-user.ts`, `edge-functions.ts`.
*(\* `engagements-db.ts` is superseded by `src/db/repositories/engagements.ts` —
port its remaining functions there, then delete the stub.)*

**Hooks / realtime (Phase 1)** — TanStack Query, no Supabase realtime:
`use-board-resolution-progress.ts`, `use-intern-portfolio.ts`,
`supabase/use-realtime-*.ts` (these become polling or no-ops).

**localStorage last mile (Phase 2)**:
`src/context/use-app-provider-value.ts` (annotated), `src/lib/storage.ts`
(deprecation shim), `compliance/compliance-store.ts`.

**Email (Phase 3)** — consolidate to the DB-backed system, Resend sender:
`email/{welcome-email,intern-welcome-email,merge-cc,request-create-intern,request-resend-welcome-email,fetch-engagement-progress-cc}.ts`.

**API routes (Phase 1)** — 18 routes stashed in `app/api/_reference-supabase/`;
port using `app/api/engagements/route.ts` as the template, then delete that folder.

## 🔴 Drop after porting
`legacy-engagement-ids.ts`, `supabase/{client,server}.ts`, `data/mockData.ts`,
and `app/api/_reference-supabase/` once their logic has moved.

## Suggested first commands in Claude Code
```bash
cp .env.example .env.local           # set AUTH_SECRET
npm install
npm run infra:up && npm run db:generate && npm run db:migrate && npm run db:seed
npm run typecheck                     # fix type errors from the new layer first
npm run test                          # the 44 LIFTed tests should mostly pass as-is
npm run dev
```
