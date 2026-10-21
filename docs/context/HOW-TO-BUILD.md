# How to build here

Concrete recipes for the changes this codebase sees most. Each one names the files to touch and
the commands to run, copied from how the code does it today. Read `CLAUDE.md` (golden rules) first.
Finish every change with `npm run check` (typecheck, then lint, then test; it stops at the first
failure). Until the client-portal accessibility pass lands, lint fails on known `jsx-a11y` errors
in `src/components/client-portal/`; check that your change adds no new ones.

## Where is X?

| Concern | Path |
|---|---|
| Sign-in, sessions | `src/auth/config.ts` (Node, providers), `src/auth/config.base.ts`, `src/auth/edge.ts` (no DB, used by `proxy.ts`) |
| Roles, `AuthContext`, API guards | `src/auth/guards.ts` (`AppRole`, `requireAuth`, `requireRole`, `requireAdminOrManager`, `requireAnyRole`) |
| URL protection and role homes | `proxy.ts` (`roleHome`, `roleSegment`; unauthenticated users go to `/login`) |
| Staff page routes | `app/app/{super,admin,manager,intern}/**/page.tsx`, shell in `src/components/shell/AppShell.tsx` |
| Staff navigation | `src/components/shell/RoleSidebar.tsx`, `shell-back.ts` (primary paths), `shell-crumbs.ts`, `CommandPalette.tsx` |
| Client portal routes and nav | `app/app/client/**`, `src/components/client-portal/routes.ts`, `Sidebar.tsx`, `ClientPortalGate.tsx` |
| Page components | `src/views/<area>/` (staff and legacy client), `src/components/client-portal/pages/<area>/` (portal) |
| API route handlers | `app/api/**/route.ts`; body parsing `src/lib/api/parse-body.ts` |
| Data access (the seam) | `src/db/repositories/*.ts`, rules in `src/db/repositories/README.md` and `docs/context/notes/data-access.md` |
| Schema and migrations | `src/db/schema.ts` (re-exports `schema-portal-*.ts`), `src/db/migrations/`, `drizzle.config.ts` |
| Seeds | `scripts/seed.ts` (`@vcfo.local` users), `scripts/seed-demo.ts` + `seed-demo-extras.ts` |
| Domain logic | `src/lib/` (checklist, compliance, doc-pack, ask, client-portal), pure data in `src/data/` |
| docx generation | `src/lib/board-resolution-*.ts`, `src/lib/incorporation-docs/`, `src/lib/doc-pack/registry.ts`, templates in `public/templates/`, template builders `scripts/prepare-*.mjs`, `scripts/incorp-docx-*.mjs` |
| File storage (S3 / MinIO) | `src/storage/s3.ts` (`putObject`, `signedDownloadUrl`, `bucketKey`) |
| Background jobs | `src/jobs/*.ts`, client `src/jobs/client.ts`, registered in `app/api/inngest/route.ts` |
| Email | `src/lib/email/send-email.ts` (`sendEmail`), layout `email-layout.ts`, engagement events `notify-engagement-event.ts` |
| WhatsApp | `src/lib/notify/send-whatsapp.ts` (`queueWhatsAppSends`), events `types.ts`, variables `templates.ts`, job `src/jobs/whatsapp-send.ts` |
| In-app bell | `src/db/repositories/notifications.ts` (`createNotification`, `createNotificationsForUsers`) |
| Design tokens | `docs/design/design-tokens.json` (source), block in `app/globals.css`, Tailwind names in `tailwind.config.ts`, rules in `docs/context/notes/design-system.md` |
| Shared UI | `src/components/dash/` (`DashHero`, `DashSection`), `src/components/common/IconChip.tsx`, `src/components/ui/` (`button-variants.ts`) |
| Client portal CSS | edit `src/components/client-portal/css-src/`, generated `css/` (gitignored), `scripts/cp-css.mjs`, cascade in `portal-css.ts` |
| Tests | `vitest.config.mts`, `src/test/setup.ts`, tests beside code as `*.test.ts`; Playwright in `e2e/`, `playwright.config.ts` |
| Deploy | `Dockerfile`, `infra/` (Terraform), `infra/README.md`, `docs/context/AWS-DEPLOY.md` |

## Add a page for a staff role

1. Write the page component in `src/views/<area>/MyPage.tsx` (client component if it fetches with
   TanStack Query; see `src/views/announcements/AnnouncementsPage.tsx`).
2. Add a thin route file `app/app/<role>/<slug>/page.tsx` that exports `metadata` and renders the
   view, as `app/app/manager/announcements/page.tsx` does with `pageMetadata(...)` from
   `src/lib/page-metadata.ts`. The role layout (`app/app/manager/layout.tsx`) already wraps it in
   `AppShell requireRole="manager"`.
3. Add the sidebar entry in `src/components/shell/RoleSidebar.tsx` (`{ to: \`${base}/slug\`, label, icon, iconTone }`).
4. If it is a top-level destination, add the path to `SHELL_PRIMARY_PATHS` in
   `src/components/shell/shell-back.ts` and a label in `shell-crumbs.ts`; optionally a
   `CommandItem` in `CommandPalette.tsx`.
5. Repeat step 2 for each role that should see it. `proxy.ts` already blocks other roles' segments.
6. Run `npm run check` and open the page under `npm run dev`.

## Add a client-portal page

1. Add the route key to `PortalRouteKey`, `PORTAL_PATHS` and `PORTAL_TITLES` in
   `src/components/client-portal/routes.ts`, and the nav item in `Sidebar.tsx`.
2. Build the page in `src/components/client-portal/pages/<area>/MyPage.tsx`; read data through
   `/api/client/*` with `useQuery` (see `pages/team/TeamPage.tsx`) and `usePortal()` for the
   current company.
3. Export an entry that falls back to a legacy view for super admins, as
   `ClientTeamEntry` does in `pages/team/index.tsx` (`portal ? page : legacy`).
4. Add `app/app/client/<slug>/page.tsx` rendering `<MyEntry legacy={<OldView />} />`
   (pattern: `app/app/client/team/page.tsx`).
5. Styles: create `css-src/<area>-<name>.css` starting with `/* @cp-scope page=<area> */`, run
   `npm run css:portal`, and import `'../../css/<area>-<name>.css'` from the page. Never edit `css/`.
6. Use real `<button>` and `<a href>` elements so the page adds no `jsx-a11y` lint errors.

## Add an API route handler

1. Create `app/api/<area>/route.ts` (or `[id]/route.ts`) exporting `GET`, `POST`, and so on.
2. Call a guard first: `const guard = await requireAuth()` (or `requireAdminOrManager()`,
   `requireAnyRole(...)`); return `NextResponse.json({ error: guard.error }, { status: guard.status })`
   when `guard.ok === false`.
3. Validate the body with a zod schema and `parseJsonBody(request, schema)` from `src/lib/api/parse-body.ts`.
4. Call repository functions with `guard.ctx`; never import `db` or `s3` in the route.
5. Record significant writes with `recordAuditEvent` from `src/db/repositories/audit-events.ts`.
6. Reference: `app/api/announcements/route.ts` (GET for every role, POST for staff).

## Add a repository method (AuthContext, role scope, cross-tenant test)

1. Add the function to `src/db/repositories/<table>.ts` with `ctx: AuthContext` as the first
   argument. This folder is the only place that may import `db` from `@/db/client`.
2. Branch on `ctx.role` and filter by the scoping keys (`ctx.userId`, `ctx.internId`,
   `ctx.clientId`). Refuse before querying when a role has no access (pattern: `createTask` in
   `tasks.ts` throws for clients). `engagements.ts` is the reference shape.
3. Add or update the row for the table in the access table in `src/db/repositories/README.md`.
4. Test in `<table>.test.ts`: mock `@/db/client` with the chain stub used in
   `announcements.test.ts`, build a `ctx(role)` per role, and assert another firm's rows return
   nothing and write nothing (see "update on another firm's task" in `tasks.test.ts`).
5. Run `npx vitest run src/db/repositories/<table>.test.ts`, then `npm run check`.

## Add a DB column or table

1. Edit `src/db/schema.ts`, or the matching `src/db/schema-portal-*.ts` file (re-exported at the
   bottom of `schema.ts`, which is what `drizzle.config.ts` reads).
2. Run `npm run db:generate -- --name <short_name>`; it writes `src/db/migrations/00NN_<short_name>.sql`
   plus a snapshot under `meta/`. Read the SQL and keep it additive (new nullable columns or defaults).
3. Run `npm run db:migrate` against local Docker Postgres (`npm run infra:up` first).
4. Seed: add base rows to `scripts/seed.ts` only if login needs them; demo rows go in
   `scripts/seed-demo.ts` or `seed-demo-extras.ts`. Run `npm run db:seed-demo`.
5. Expose the data through a repository method (recipe above), never directly.
6. Production: migrate RDS before or with the deploy (see "Deploy" below and `AWS-DEPLOY.md` section 5).

## Add an Inngest job

1. Create `src/jobs/<name>.ts` with `inngest.createFunction({ id: '<name>' }, { cron: '0 7 * * *' } or
   { event: '<event-name>' }, async ({ step }) => { ... })`, importing `inngest` from `./client`.
2. Wrap each side effect in `step.run('<label>', ...)` so retries do not repeat it
   (pattern: `src/jobs/compliance-reminders.ts`).
3. Jobs have no session. Use the `system*` repository helpers (for example
   `systemListDueComplianceReminders`) rather than faking an `AuthContext`.
4. Register the function in the `functions` array in `app/api/inngest/route.ts`.
5. Run it locally with `npm run inngest:dev` beside `npm run dev`. Production Inngest cloud keys are
   still deferred (see `STATE.md`).

## Send an email or WhatsApp notification

1. Email first, always: `sendEmail({ to, subject, html, ... })` from `src/lib/email/send-email.ts`.
   Build the HTML with `renderEmailDocument`, `emailParagraph` and `emailCallout` from `email-layout.ts`.
2. For checklist and engagement events reuse `notifyEngagementEvent` in
   `src/lib/email/notify-engagement-event.ts`; it resolves recipients, writes bell rows and fans out.
3. In-app bell rows: `createNotificationsForUsers` in `src/db/repositories/notifications.ts`.
4. WhatsApp is an optional nudge after email: call `queueWhatsAppSends([...])` from
   `src/lib/notify/send-whatsapp.ts`. It never throws and never blocks the request.
5. A new WhatsApp event needs an entry in `NOTIFY_EVENTS` (`src/lib/notify/types.ts`), a variable
   builder in `templates.ts`, and an approved template (setup in `docs/context/notes/aws.md`).
6. Locally, missing provider keys make `sendEmail` log and skip; that is expected.

## Use design tokens and shared components in UI

1. Colour, radius and size come from Tailwind token names (`bg-surface`, `bg-surface-raised`,
   `text-ink`, `text-ink-muted`, `border-line`, `bg-brand`, `text-positive`, `h-control-md`).
   Do not add hex values or the deprecated aliases (`gold`, `accent-*`, `phase`, `role`).
2. Page greeting card: `DashHero` from `src/components/dash/DashHero.tsx` (`title`, `subtitle`,
   `stats`, `ring`). Section card: `DashSection` from `DashSection.tsx` (`icon`, `tone`, `title`,
   `meta`, `href`). Example: `src/views/admin/DashboardSections.tsx`.
3. Icon chips: `IconChip` from `src/components/common/IconChip.tsx` with an `IconChipTone`.
4. Buttons: `Button` from `src/components/ui/button.tsx` with `variant` (`default`, `outline`,
   `secondary`, `ghost`, `destructive`, `success`, `link`) and `size` from `button-variants.ts`.
5. Changing a token: edit `docs/design/design-tokens.json`, run `npm run tokens`, then
   `npm run tokens:check` (contrast gate). Check `docs/design/COMPONENTS.md` before adding a component.

## Add a Vitest test and a Playwright spec

1. Unit test: create `<file>.test.ts` beside the code (`src/lib/announcements.ts` would get
   `src/lib/announcements.test.ts`). Globals and jsdom come from `vitest.config.mts`; `@/` resolves
   to `src/` and `server-only` is stubbed.
2. Run one file with `npx vitest run path/to/file.test.ts`; run all with `npm run test`.
3. Component tests use Testing Library (setup in `src/test/setup.ts`).
4. Browser spec: add `e2e/<feature>.spec.ts`. Sign in with the helpers and demo users in
   `e2e/helpers/login.ts` (needs `npm run db:seed-demo`). Tag phone-only tests `@mobile`.
5. Run `npm run e2e` (it reuses a running dev server) or `npx playwright test e2e/<feature>.spec.ts`.

## Deploy

1. Run `npm run check` and `npm run build` locally (`prebuild` regenerates the portal CSS).
2. If the change adds a migration, migrate RDS first: export `DATABASE_URL` from Secrets Manager and
   run `NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem npm run db:migrate` (`AWS-DEPLOY.md` section 5).
3. Log in to ECR, then build and push `:latest`; the exact commands are in `infra/README.md`
   (`docker build -t vcfo-suite:local .`, `docker tag`, `docker push .../vcfo-suite:latest`).
4. App Runner auto-deploys on the new `:latest` image. Watch the service in the console.
5. New env vars or secrets go through Terraform in `infra/` (`terraform apply`), never into the image.
6. Record the deploy (commit, time, migrations) in `docs/context/STATE.md`.
