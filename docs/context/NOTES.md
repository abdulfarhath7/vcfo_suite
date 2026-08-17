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
- **From + Reply-To:** Client → lead process mail is Resend From
  `{sanitized-company-name}@sbctrack.in` (e.g. `Acme Pvt Ltd <acme-pvt-ltd@sbctrack.in>`)
  so Outlook can filter; Reply-To is the client. Lead → client is **not** Resend:
  the app opens compose, then Graph `Mail.Send` from the lead’s linked Outlook mailbox.
- **Outlook Graph:** `AZURE_AD_CLIENT_ID` / `_SECRET` / `_TENANT_ID`. Connect at
  `/api/outlook/connect`. Tokens in `outlook_connections` (encrypted with
  `AUTH_SECRET`). Not an Auth.js login provider.
- **Resend onboarding sender:** `FROM` with `@resend.dev` can only deliver to
  the Resend account owner. Use explicit `EMAIL_DEV_REDIRECT_TO` /
  `RESEND_DEV_REDIRECT_TO` only for deliberate local testing. Verify a domain
  for real lead delivery.
- **SES flip:** set `EMAIL_PROVIDER=ses`, verify domain in SES (`SES_REGION` /
  `ap-south-1`), leave sandbox via production access request. Keep Resend until
  that works. See `docs/context/AWS-DEPLOY.md` §8.
- Client submit / client document upload → lead (+ manager) via Resend
  `{company-name}@sbctrack.in`. Review / deliver / share / request / unlock
  open in-app compose for Graph send to the client. Lead resolve needs
  `profiles.intern_id` to match `engagements.intern_id`.
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


## Design tokens (cool blue primary)

- **Primary is professional blue** (`--primary` / `--brand` / `--blue-*` ≈ `#2563EB`,
  hover `#1D4ED8`). Buttons, links, focus rings, current-step nodes, progress,
  key CTAs. White label on blue — never navy-on-blue. Do **not** use orange,
  terracotta, peach, or sand as brand or page atmosphere.
- Neutrals: cool slate with a blue undertone (`--background` ≈ `#F8FAFC`, cards
  white, borders `--border` ≈ slate-200). Never beige/cream.
- `--orange-*` / `--gold-*` are **deprecated aliases of `--blue-*`** so leftover
  class names still resolve blue. Prefer `primary` / `blue-*` in new UI.
- Phase washes (journey chips only, ~8–12% chroma): `--phase-pre` sky,
  `--phase-filing` teal, `--phase-post` teal-green, `--phase-fema` indigo,
  `--phase-registration` violet-blue. Helper: `src/lib/phase-colors.ts`.
- Status (chips/icons only, never page fill): teal-green done · muted gold
  waiting · slate lock · rose/red overdue/error.
- Super Admin: tiny `.super-gold-chip` badge only — never a gold CTA theme.
- Shared journey node: `JourneyNode` (blue active pulse, teal check, amber
  clock icon, slate lock). Motion: `.journey-node-pulse`, `.journey-unlock`,
  `.journey-complete`, `.page-fade-up`, `.skeleton-brand`, `.page-atmosphere`
  (faint blue mesh ≤4%).
- Dark mode stays in the same cool blue/slate family — not a brown invert.
- Fonts: Manrope (UI) + Space Grotesk (display via `--font-serif`) + IBM Plex Mono

## Sequential checklist gate

- Steps unlock only after the previous **active catalog** item is terminal-complete
  (`completed` / `not-applicable` / client submit / deliver). Save-draft does not unlock.
- Rejected or unlocked-for-correction steps re-lock everything after them.
- Helper: `src/lib/checklist-step-gate.ts`. Server save path: `patchChecklistItem`.
- Copy: “This opens after {title} is complete.” / “Waiting on the client…” — never “access denied”.
- Overdue badges only on the current (active/waiting) step, never on locked future steps.
- Client **Progress** nav (`/app/client/progress`) was removed; the gated catalog
  now lives as a Create-project-style flowchart on Incorporation. Old `/progress`
  URLs redirect there. Staff progress CC / intern % helpers are unrelated.
