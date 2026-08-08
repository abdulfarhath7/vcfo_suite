# CLAUDE.md — build instructions for Claude Code

This repo is a **scaffold**. It was re-platformed from SBC-Track (Supabase) to
the AWS-target stack (Postgres + Drizzle + Auth.js + S3), but it is **not yet
verified to build** — the environment that scaffolded it had no network and
could not run `npm install`, `tsc`, or the tests. Your job is to make it real
and green, phase by phase, verifying each step.

## Read this first

`docs/context/` is the live working memory for this build — read it at the start of
every session, and update it as you go:

- `docs/context/STATE.md` — what is actually verified green right now (supersedes
  `BUILD-STATUS.md`, which describes the pre-install scaffold)
- `docs/context/TASKS.md` — the checklist, phase by phase, with exit criteria
- `docs/context/NOTES.md` — gotchas already paid for once

## Ground truth about this codebase

- **~80% of the code is LIFTed unchanged** from the original: the 34-step
  checklist (`src/data/checklist.ts`), all per-step validation modules and
  their tests (`src/domain/checklist-*`), docx generation
  (`src/domain/board-resolution-*`, `src/domain/incorporation-docs/`),
  compliance math (`src/domain/compliance/`), UI components, and views.
- **The new layer** is: `src/db/` (Drizzle + repositories = the seam),
  `src/auth/` (Auth.js + guards), `src/storage/` (S3/MinIO), `src/jobs/`
  (Inngest). These are written but untested.
- **Access control = Path A**: enforced in the repository layer, NOT Postgres
  RLS. The old RLS policies are the SPEC — see `MIGRATION.md`.
- The original API routes are stashed in `app/api/_reference-supabase/` for
  reference. Port them into real routes, then delete that folder.

## Golden rules

1. **The seam is sacred.** Only `src/db/repositories/*` may import `db`. Views,
   domain logic, and routes call repositories. If you're tempted to import
   `db` or `s3` in a component, stop — add a repository function instead.
2. **Every repository takes an `AuthContext` and scopes by role.** Reproduce
   the RLS table in `src/db/repositories/README.md`. Add a cross-tenant test
   for each.
3. **Don't touch the LIFTed domain code** unless a test fails. It's ported and
   was already tested in the original.
4. **Dev/prod parity.** Local uses Docker Postgres + MinIO; AWS uses RDS + S3.
   Never hardcode endpoints — everything flows through env vars.
5. **Verify each phase** with `npm run typecheck && npm run test` before moving
   on. Don't stack unverified work.

## Setup (do this first)

```bash
cp .env.example .env.local          # then set AUTH_SECRET (openssl rand -base64 32)
npm install
npm run infra:up                    # start Postgres + MinIO in Docker
npm run db:generate                 # generate Drizzle migration from schema.ts
npm run db:migrate                  # apply to local Postgres
npm run db:seed                     # create demo manager/intern/client + engagement
npm run dev                         # http://localhost:3000
```

If `npm install` surfaces version conflicts, resolve them minimally — prefer
the versions in `package.json`; only bump when a peer-dep genuinely requires it.

## Phased plan (do in order; verify each)

### Phase 0 — Make it compile & log in
- `npm install`, resolve any type errors from the new `src/db`, `src/auth`,
  `src/storage` files.
- Fix import paths: LIFTed files that imported `@/lib/...` may now live under
  `@/domain/...`. Update imports (or add `@/lib` path aliases) until `npm run
  typecheck` passes.
- Wire the login page (`app/login`) to Auth.js `signIn`.
- **Exit:** you can log in as the seeded manager and land on the dashboard;
  `npm run typecheck` passes.

### Phase 1 — Port the data surface behind the seam
- Reconcile `src/db/schema.ts` against the real SQL in
  `../SBC-Track-main/supabase/migrations/` (especially `compliance_*` and
  board-resolution columns — marked TODO in schema.ts).
- Implement the remaining repositories (documents, knowledge-bank, compliance,
  board-resolution) following `engagements.ts`. Rewrite the Supabase-coupled
  files stashed in `src/db/repositories/_rewrite-from-supabase/`.
- Port the ~18 API routes from `app/api/_reference-supabase/` using
  `app/api/engagements/route.ts` as the template. Delete the reference folder
  when done.
- Move file storage calls to `src/storage/s3.ts`.
- **Exit:** manager + client run a full engagement end-to-end against local
  Postgres + MinIO; tests green.

### Phase 2 — Finish the localStorage last mile
- The original kept tasks/requests/invites/activity/notifications in
  localStorage. Tables already exist in `schema.ts`. Build their repositories
  and replace the `read()/debouncedPersist()` calls in the ported
  `use-app-provider-value` with TanStack Query hooks that call the API.
- **Exit:** clear browser storage, lose nothing; work resumes on any machine.

### Phase 3 — Jobs & email
- Implement `src/jobs/compliance-generate.ts` using the LIFTed pure logic in
  `src/domain/compliance/`. Retire any remaining `compliance-store` localStorage.
- Consolidate email onto ONE DB-backed system (drop the hard-coded templates).
  Keep Resend as the sender; locally, log to console when `RESEND_API_KEY` is
  empty.
- **Exit:** compliance digest fires via Inngest dev server; one email path.

### Phase 4 — Pilot hardening (local)
- `npm run start:lan` to bind on 0.0.0.0 for office-WiFi access.
- Make sure all 44 LIFTed tests plus new repository tests pass.
- **Exit:** 10 people on the office WiFi can use it end-to-end.

### Stage 2 (later) — AWS
- See `infra/` and `MIGRATION.md`. It's a deployment + env-var change, not a
  rewrite, because of the seam.

## Things NOT to do
- Don't reintroduce Supabase.
- Don't add Kubernetes/microservices/Lambda-everything. App Runner + RDS + S3.
- Don't put secrets in the client bundle or commit `.env.local`.
- Don't bypass the repository seam for "just this one query."

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
