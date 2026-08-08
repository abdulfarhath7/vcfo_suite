# NOTES — gotchas worth not rediscovering

Append here whenever something costs more than a minute to figure out.

## Environment

- DB user is `vcfo`, not `postgres`. `docker exec vcfo-postgres psql -U vcfo -d vcfo`.
  Connecting as `postgres` fails with `role "postgres" does not exist`.
- Containers `vcfo-postgres` and `vcfo-minio` are already running; `npm run infra:up`
  is idempotent, so re-running is safe.

## Typecheck

- `app/api/_reference-supabase/` has been deleted (Phase 1d). Residual typecheck
  noise is from leftover Supabase stubs (`src/lib/supabase/*`) and missing
  `useInternPortfolio` — not from API routes.
- `_rewrite-from-supabase/` has been deleted; incorporation docs live under
  `src/lib/incorporation-docs/` (storage/share/preview-save).

## Phase 3

- Compliance generation is a system job: call
  `systemGenerateComplianceInstances` / `runComplianceGenerate` from Inngest
  only — it uses `db` without AuthContext inside the repository file.
- Obligation FK rows are upserted from `COMPLIANCE_OBLIGATIONS` on first run.
- Shared email helper: `src/lib/email/send-email.ts` (dispatcher). Transports:
  `send-via-resend.ts` (default) and `send-via-ses.ts` when `EMAIL_PROVIDER=ses`.
  Do not add a second Resend/SES call site — use `sendEmail` / `sendResendEmail`.
- Process emails + dashboard fan-out: `notifyEngagementEvent` /
  `notifyEngagementEventBackground` in `src/lib/email/notify-engagement-event.ts`.
  Wired on checklist submit/review/unlock/deliver, incorp docs share, and
  document-request create. Recipients resolved via
  `src/db/repositories/engagement-recipients.ts`. Without configured From /
  Resend key (or SES identity), sends console-skip (same as welcome).
- **From + Reply-To:** Always send From `EMAIL_FROM` / `RESEND_FROM_EMAIL` /
  `SES_FROM_EMAIL` (verified company domain). Process mail sets Reply-To to
  the human: client submit → Reply-To client; review/deliver/request → Reply-To
  lead/manager. Welcome emails Reply-To the manager. Do not set From to
  personal user inboxes.
- **Resend onboarding sender:** `FROM` with `@resend.dev` can only deliver to
  the Resend account owner. Use explicit `EMAIL_DEV_REDIRECT_TO` /
  `RESEND_DEV_REDIRECT_TO` only for deliberate local testing. Verify a domain
  for real lead delivery.
- **SES flip:** set `EMAIL_PROVIDER=ses`, verify domain in SES (`SES_REGION` /
  `ap-south-1`), leave sandbox via production access request. Keep Resend until
  that works. See `docs/context/AWS-DEPLOY.md` §8.
- Client submit emails **lead only** (manager if lead missing). Review emails
  clients. Lead resolve needs `profiles.intern_id` to match `engagements.intern_id`.
- In-app rows for those events are inserted with `createNotificationsForUsers`
  (server). Client checklist diffs toast + invalidate the bell but do not
  re-persist those kinds (avoids duplicates).

## Stubs

- Stub files `throw` on import by design, so a missing port shows up as a runtime crash
  rather than shipping silently. A `TS2305: has no exported member` error usually means
  "this stub still needs writing", not "the import path is wrong".

## Four-role scoping

- `admin` = firm-wide (old manager unrestricted). `manager` = rows where
  `engagements.manager_id = ctx.userId`, with legacy fallback
  `manager_id IS NULL AND admin_id = ctx.userId`.
- Creating a project as admin requires `managerId` in the POST body; as
  manager, `managerId` is forced to `ctx.userId` and `adminId` stays null.
- Prefer `requireAdminOrManager()` for firm ops (create project, interns,
  KB write/delete, welcome email, audit-log read). Reserve `requireAdmin()`
  for create/list managers APIs.
- Cross-role URLs bounce via middleware segment check — use `staffBase` /
  `adminProjectPath(eng, roleOrBase)`, not hardcoded `/app/manager`.
- Guard narrowing: use `if (guard.ok === false)` so TS sees `error`/`status`.

## LAN / phone access

- Use `npm run dev:lan` (binds `0.0.0.0`) — plain `next dev` is localhost-only.
- Next 15+ blocks cross-origin `/_next/*` from LAN IPs unless `allowedDevOrigins`
  is set (`next.config.mjs`). Symptom: HTML loads, login fields/toggles dead.
- Prefer unset `AUTH_URL` with `AUTH_TRUST_HOST=true`, or set `AUTH_URL` to the
  same LAN URL devices open.

## Phase 2 mapping

- Task DB `open|in-progress|done` ↔ app `not-started|in-progress|completed` (other
  StatusCodes write as `open` on the way in).
- Doc request `fulfilled→uploaded`, `cancelled→rejected`; `approved` stored as plain text.
- Notification extras (`kind`, `href`, …) JSON-encoded in `notifications.description`.

## Docs that drift

- `BUILD-STATUS.md` describes the pre-install scaffold and is now partly stale (it claims
  nothing has been installed or run). Trust `docs/context/STATE.md` over it.
- `CLAUDE.md` carries a Next.js block auto-written by `next dev`. Committing it alongside
  other work keeps the tree clean; deleting it just regenerates.

## Multi-client + Super Admin

- Membership table: `engagement_clients` (owner/member). Primary still on
  `engagements.client_user_id` for legacy. SQL:
  `scripts/sql/20260810_multi_client_super_admin.sql`.
- Clients invite peers via `POST /api/engagements/:id/clients` and
  `/app/client/team`. Audited as `client.invite`.
- Clients substitute (self or peer) via
  `POST /api/engagements/:id/clients/substitute` — swaps membership, moves
  primary when replacing owner, welcome email for new accounts, audit
  `client.substitute`. Self-substitute signs the actor out of the portal.
- Client audit: `/app/client/audit` uses scoped `GET /api/audit-logs`.
- `super_admin` may enter every `/app/*` segment (middleware). Home:
  `/app/super/dashboard`. Seed: `super@vcfo.local` / `super123`.

- Browser POSTs multipart to `/api/engagements/:id/milestone-documents`
  (fieldId + file). Server auth + `assertEngagementAccess`, then S3/MinIO under
  prefix `milestone-documents/`.
- Downloads use `/api/milestone-documents/signed-url?path=…` (role-scoped).
- A 404 on upload almost always meant these routes were missing — they must stay
  in sync with `src/lib/milestone-document-storage.ts`.


- Primary `#1A1B22` · Action `#7C5CFC` · Surface `#F7F6FB` · Accent `#A78BFA`
- Status: ok / warn / danger from the palette card
- Fonts: Manrope (UI) + Space Grotesk (display via `--font-serif`) + IBM Plex Mono
- Legacy class names `orange-*`, `gold-*`, `indigo-*` resolve to violet action tokens
