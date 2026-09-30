# Email, process fan-out and Outlook compose

Gotchas already paid for once. Append when something costs more than a minute to figure out.

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
  `/api/outlook/connect` or Settings. Tokens in `outlook_connections` (encrypted
  with `AUTH_SECRET`). Not an Auth.js login provider. Staff compose page:
  `/app/{intern|manager|admin}/mail` — Graph send from the signed-in user’s
  mailbox; directory is engagement-scoped (+ intern `reports_to_manager_id`).
- **Resend onboarding sender:** `FROM` with `@resend.dev` can only deliver to
  the Resend account owner. Use explicit `EMAIL_DEV_REDIRECT_TO` /
  `RESEND_DEV_REDIRECT_TO` only for deliberate local testing. Verify a domain
  for real lead delivery.
- **SES flip:** set `EMAIL_PROVIDER=ses`, verify domain in SES (`SES_REGION` /
  `ap-south-1`), leave sandbox via production access request. Keep Resend until
  that works. See `docs/context/AWS-DEPLOY.md` §8.
- Client submit / client document upload → **lead + every project manager**
  via Resend `{company-name}@sbctrack.in` (Reply-To = client). Managers are
  resolved from `engagements.manager_id`, `engagement_managers` membership,
  then intern `reports_to_manager_id` if those are empty. Intern **Request
  manager approval**, **Email manager again**, and **Submit** set
  `reviewSource=lead_manager_request` and email **managers only** from the
  lead’s Outlook when connected, else Resend. Intern **autosave** only patches
  `{ responses }` and must **not** repeat that email. Re-requesting after
  accept (Request / Submit) reopens review and emails again; manager Accept then
  composes to the client again (CC admin + lead). Manager Accept opens Graph
  compose **to the client**, CC firm admins + leads (+ engagement progress CC).
  Review reject / deliver / share / request / unlock / **board-resolution
  finalize** also open in-app compose for Graph send to the client. Lead resolve
  needs `profiles.intern_id` to match `engagements.intern_id`.
- **Board resolution finalize** (`POST .../board-resolution/finalize`) is the
  only release action — it sets `status=finalized`, marks Pre-2
  `deliveredToClientAt` (unlocks Pre-3 signed upload), and
  `notifyEngagementEvent({ event: 'board_resolution_shared' })` for Graph
  compose + in-app Received. Re-clicking Send to client reopens compose
  without duplicating in-app rows. Client GET already hides drafts until
  finalized; the missing piece was notify + sequential-gate delivery, not a
  `shared_with_client` documents-table flag.
- In-app rows for those events are inserted with `createNotificationsForUsers`
  (server). Client checklist diffs toast + invalidate the bell but do not
  re-persist those kinds (avoids duplicates).
- **No lead “Deliver to client” any more** (2026-09-15). The intern footer only has
  Save / Request manager approval / Submit; `handleDeliverToClient` is gone. The
  manager’s Accept of a `lead_manager_request` is the delivery: `reviewChecklistItem`
  stamps `deliveredToClientAt` (so `isDeliveredToClient`, intern-work `done`, client
  toasts all read it) and, for pre-12, copies `responses.dateOfIncorporation` onto
  `engagements.incorporation_date`. `validateInternDelivery` (pre-4 / pre-5 required
  uploads) now runs inside the intern **Submit** for `INTERN_DELIVERY_STEP_IDS`.
  Server gate: `POST /checklist` runs an intern patch through `leadWritablePatch`
  (drops `deliveredToClientAt`, `completedOn`, `reviewedAt/By`, `approval`, any
  `reviewStatus` but `reviewing`, and `status` completed / not-applicable), so no
  client build can release a step on the lead’s say-so. The `event: 'delivered'`
  notify path is unreachable from routes now (kept for the WhatsApp template map).

- **react-day-picker v10 marks the `<td>` selected, not the day button.**
  `aria-selected:` utilities on `day_button` never match, and the `ghost`
  button variant's `text-primary` paints the selected day blue-on-blue. Use a
  parent selector on the button (`[[aria-selected=true]_&]:text-primary-foreground`),
  as `NoirDatePicker` does.

## Intern autosave vs manager-approval email

- Intern draft persist uses the same `POST /checklist` as Save, but only
  `{ responses }`. Do **not** fan out `lead_requested_review` when answers
  change while the step is already awaiting review — that stacked identical
  “manager approval requested” toasts (and emails) on every field debounce.
  Notify only when the PATCH itself includes `reviewSource=lead_manager_request`
  (Request / Submit) or `resendManagerEmail` (Email manager again). Helper:
  `src/lib/email/lead-manager-request-notify.ts`. Email toasts use a stable
  `email-dispatch:…` id so a retry replaces rather than stacks. Undo toast id
  stays `notification-undo` (top-right).

## Send email compose (To filters + templates)

- Staff page: `/app/{intern|manager|admin}/mail`. To is one compact row:
  chips + name search, with **Team** (reports-to manager) and **Client**
  (engagement company) selects beside the field. Picking a **Client** writes
  that company’s client `profiles.email` into the To field as a visible
  address chip (not a name-only pill). Directory also resolves clients via
  `engagements.client_id` → `profiles.client_id` when `client_user_id` is
  empty. Changing or clearing Client swaps only those auto-added chips.
- Templates reuse `email_templates` (firm-scoped). New column `branding`
  (`sbc` | `plain`) via `0008_email_template_branding.sql`. CRUD:
  `/api/email-templates`. Interns edit/delete **own** rows; admin/manager any.
- Send path: `POST /api/outlook/send` with `templateId` / `branding`. If
  `templateId` is set, branding is loaded from the DB (not trusted from the
  client). `sbc` wraps HTML with `renderEmailDocument({ brand: 'sbc' })`
  (`src/lib/email/compose-branding.ts`), hosting `public/sbc-logo-light.png`
  via `siteUrl()` (no CID / Resend attachment). Process-email compose that already
  sends `html` is unchanged. Default untemplated send stays `plain`.
- Staff compose To also takes typed addresses outside the directory
  (`src/lib/email/recipient-input.ts`): Enter / comma / Tab / blur / paste
  turn text into chips, a typed directory address selects that person
  instead, Backspace on empty text drops the last chip. `?to=` with an
  unknown address becomes a chip too. Server (`/api/outlook/send`) already
  accepted any address — only the UI was directory-bound.
- Directory now returns inactive people too; To defaults to **Active**. Team
  filter uses `profiles.reports_to_manager_id`.
