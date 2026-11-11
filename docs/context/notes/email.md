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

## Pre-incorporation direct flow mail (2026-10-13)

- `step_submitted` by a client → Resend to leads + managers (`{company}@sbctrack.in`, Reply-To
  the client). By the lead → Resend to the clients, managers on CC (`directFlowEmailPlan`).
- `step_waiting_on_lead` → Resend to leads only. `step_reopened` → no mail.
- `pre-12` WhatsApp `coi_issued` now fires on `step_submitted` (the old Accept path is unused
  for direct-flow steps). A WhatsApp failure still never touches the email path.
- Board resolution "Send back" (`review_rejected` on `pre-2`): no client compose draft, no
  client bell; Resend to the leads with the manager's note. "Approve and send to client" keeps
  the existing `board_resolution_shared` compose to the client.

## Spectrum email design (2026-11-11)

- Every email goes through `renderEmailDocument` in `src/lib/email/email-layout.ts`, drawn in
  VCFO Spectrum: surface canvas, one raised card with the `line` hairline and 6px corners, the
  DashHero wash as the header band (letterhead, eyebrow, title), a primary `brand` button, a
  sunken footer. Do not write hex colours in a template; use the helpers (`emailButton`,
  `emailCallout`, `emailMetaTable`, `emailLabel`, `emailHeading`, `emailMuted`, `emailInk`,
  `emailLink`, `emailQuote`, `emailSignature`, `emailStatusWord`, `emailStatusChip`,
  `emailMono`) or `emailColor('<token>')`.
- Colours come from `src/lib/email/spectrum-email-tokens.ts`, generated from
  `docs/design/design-tokens.json` by `npm run tokens:email` (`scripts/design-tokens-email.mjs`
  converts each OKLCH triplet to sRGB hex, because mail clients read neither CSS variables nor
  oklch()). `spectrum-email-tokens.test.ts` fails when the file drifts from the JSON, so rerun
  the script after any token change. `--check` prints whether the file is current.
- Fonts follow `type.fonts` (R-28): Roboto for text, Roboto Mono for identifiers, loaded from
  Google Fonts where the client allows it, Arial / Courier New otherwise. Outlook on Windows gets
  Arial through an `[if mso]` style, because it falls back to Times when the first face is a web
  font. `emailMetaTable` puts values whose label is CIN, DIN, PAN, SRN, ARN, GSTIN (or password)
  in the mono face, and `emailIdentifiers` does the same for "CIN U7…" inside the footer.
- Dark mode: `color-scheme` meta plus a `prefers-color-scheme: dark` stylesheet that re-colours
  the `sp-*` classes with the dark tokens (Apple Mail, iOS, Outlook for Mac). Gmail web ignores
  it and shows the light palette. The SBC letterhead swaps to the white mark only inside that
  stylesheet; the white mark is hidden inline and with `mso-hide` everywhere else.
- The DashHero gradient lives in its own `<style>` block (so a client that drops it keeps the dark
  rules); Outlook shows the solid `brand-soft` band (`bgcolor`).
- Status words keep their text; a label that starts with one of the six (Overdue, Due …,
  Waiting, In progress, Not started, Done) gets its R-13 tone (`emailStatusTone`). Used by the
  compliance reminder, My day, the weekly digest headings and the receivables digest.
- Not converted on purpose: `src/lib/receivables/summary-email.ts` copies SBC finance's existing
  black-header Calibri table format, and `src/jobs/compliance-reminders.ts` /
  `src/jobs/saved-reports-send.ts` send bare unstyled HTML without the shell; wrapping them would
  add header and footer text. WhatsApp templates are untouched.
