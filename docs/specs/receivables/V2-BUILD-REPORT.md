# Receivables v2 — build report

Built 17 Nov 2026 on `feature/receivables-v2`, cut from `main` at `a4b9495f`. The design is in
`V2.md`, and the decisions taken during the build are in `V2-DECISIONS.md`.

Per the brief, nothing was tested. `npm run typecheck` passes, and `npm run lint` shows 0 errors
(the warnings are as before).

## Phases and commits

| Phase | Commit | What |
|---|---|---|
| 1 Data model | `d82a1b19` | Schema, migration 0058 with the client backfill, and the repositories `clients.ts`, `digest-recipients.ts`, `imports.ts` and `email-log.ts`. Also the Tally parser and the v2 DTOs. |
| 2 Tally import and approval | **not committed** | The import routes, the approval panel, "Import from Tally", the `r<revision>` badge, ⚑ Fix in Tally and its filter. |
| 3 Staff amount changes | **not committed** | "Change amount", the amount-change route, and approval of CHANGED rows. Shares a change set with Phase 2. |
| 4 People tab, removals, hiding | **not committed** | The People tab; the bank feed, reminders and Monday digest removed; `RECEIVABLES_EXTERNAL`; migration 0059. |
| 5 Emails | **not committed** | `email-v2.ts`, `v2-send.ts`, `v2-schedule.ts`, the four jobs, the statement and retry routes. |
| 6 WhatsApp (DoubleTick) | **not committed** | `send-whatsapp-doubletick.ts`, `WHATSAPP_PROVIDER`, the ping, the People tab card and the test route. |
| 7 Docs | **not committed** | This report, `V2.md`, `V2-DECISIONS.md`, `notes/receivables.md`, and updates to STATE.md, CLAUDE.md, PLAN.md and the repositories README. |

**Why Phases 2 to 7 are not committed:** after the Phase 1 commit, the Claude Code permission
classifier refused every `git commit` in this session. Nothing was pushed.

- The removals are already staged (`git rm`).
- To commit the rest yourself, stage the paths listed below. Do not use `git add -A`: the tree also
  holds your own edits to `.claude/launch.json`, `.dockerignore` and `docs/context/STATE.md` (three
  deploy rows), plus `.claude/worktrees/` and the brief. Then commit.
- `docs/context/STATE.md` mixes your three deploy rows with the new "Receivables v2" row and its
  "Last updated" line. Commit it on purpose, or split it.

## Files

### Added

- **Migrations:** `src/db/migrations/0058_receivables_v2.sql` (+ `meta/0058_snapshot.json`) and
  `src/db/migrations/0059_drop_bank_credits.sql` (+ `meta/0059_snapshot.json`).
- **Repositories** (`src/db/repositories/receivables/`): `clients.ts`, `digest-recipients.ts`,
  `imports.ts`, `email-log.ts`, `email-sources.ts`.
- **Domain** (`src/lib/receivables/`): `tally-sales-register.ts`, `client-key.ts`, `v2-wire.ts`,
  `email-v2.ts`, `v2-send.ts`, `v2-schedule.ts`, `external.ts`.
- **WhatsApp:** `src/lib/notify/send-whatsapp-doubletick.ts`.
- **Jobs:** `src/jobs/receivables-rollup.ts`, `receivables-leadership-digest.ts`,
  `receivables-approval-emails.ts`, `receivables-email-ping.ts`.
- **Routes** (`app/api/receivables/`):
  - `sheets/[id]/imports` (POST), `imports/pending` (GET), `imports/approve`, `imports/reject`,
    `imports/[batchId]` (DELETE);
  - `invoices/[id]/amount-change`;
  - `sheets/[id]/people`, `sheets/[id]/email-settings`, `sheets/[id]/clients`,
    `sheets/[id]/digest-recipients`, `sheets/[id]/whatsapp-test`;
  - `clients/[id]` (PATCH), `clients/[id]/statement`;
  - `partners/[id]/clients` (PUT);
  - `digest-recipients/[id]` (PATCH, DELETE);
  - `email-log/[id]/retry`;
  - `_client-fields.ts`.
- **UI:** `src/hooks/use-receivables-v2.ts`, `src/views/receivables/manager/PeopleTab.tsx`,
  `sheet/ApprovalPanel.tsx`, `sheet/ChangeAmountDialog.tsx`.
- **Docs:** `docs/specs/receivables/V2.md`, `V2-DECISIONS.md`, `V2-BUILD-REPORT.md`,
  `docs/context/notes/receivables.md`.

### Removed

- **HSBC bank feed:**
  - `src/lib/receivables/bank-feed/` (`camt`, `hsbc`, `run`, `types`, `xml`, with their tests);
  - `src/lib/receivables/match.ts` (+ test);
  - `src/db/repositories/receivables/credits.ts`;
  - `app/api/receivables/credits/[id]` and `sheets/[id]/credits` (+ `import`);
  - `src/views/receivables/manager/BankTab.tsx`;
  - `src/jobs/receivables-bank-feed.ts`;
  - `useCredits` and `useCreditActions`, and the credit DTOs.
- **Reminders:**
  - `src/jobs/receivables-reminders.ts`;
  - `src/lib/receivables/send-reminders.ts` (+ tests), `reminder-rule.ts` (+ test) and
    `send-now-route.test.ts`;
  - `src/db/repositories/receivables/reminders.ts`;
  - `app/api/receivables/reminders/[id]` and `sheets/[id]/reminders` (+ `send-now`);
  - `RemindersTab.tsx`;
  - the reminder hooks and DTOs.
- **Monday digest:** `src/jobs/receivables-digest.ts`, `src/lib/receivables/digest.ts` (+ test)
  and `src/db/repositories/receivables/digest.ts`.
- **Partners tab:** `src/views/receivables/manager/PartnersTab.tsx`, replaced by the People tab.

### Changed

- **Schema, repositories and jobs:**
  - schema;
  - repositories: `index`, `shared` (`toInvoice`), `sheets` (email settings), `partners`,
    `partner-logins` (DTO), `partner-portal` (`hitFromRow`), `versions` (publish alerts gated),
    `fx-desk` (no bank credits);
  - `outlook-connections.ts` (`systemSendMailAsResult`);
  - job registration (`app/api/inngest/route.ts`, `src/lib/dev/jobs-registry.ts`).
- **WhatsApp:** `src/lib/notify/channels.ts`, `send-whatsapp.ts` and `templates.ts` (the provider
  switch).
- **Emails:** `summary-email.ts` and `fx-alert-email.ts` (no tool links).
- **Model and DTOs:** `model.ts`, `wire.ts`, `import-workbook.ts` (exports `text` and `dateOf`).
- **Partner-facing routes and pages:** the flag added; the notes route sends the reply email only
  with the flag on.
- **Manager UI:** `ReceivablesManager` (tabs), `SheetTab`, `SheetTable`, `SheetCards`,
  `SheetFilterBar`, `cells`, `row-menu`, `use-sheet-tab`, `use-receivables.ts`; the manager page
  passes `external` and `settingsHref`.
- **Tests:** `src/db/repositories/receivables.test.ts` and `src/lib/receivables/fx-desk.test.ts`.
- **Config and docs:** `.env.example`, `.gitignore` (`docs/specs/receivables/samples/`),
  `CLAUDE.md`, `docs/context/STATE.md`, `docs/specs/receivables/PLAN.md`,
  `src/db/repositories/README.md`.

## Migrations: apply on RDS before deploy, in order

1. **`0058_receivables_v2`** is additive.
   - New tables: `receivable_clients`, `receivable_digest_recipients`, `receivable_import_batches`,
     `receivable_import_rows` and `receivable_email_log`.
   - New columns on `receivable_sheets`: the email switches and the schedule, all off by default.
   - New columns on `receivable_partners`: `notify_new_invoice` and `notify_rollup`.
   - New columns on `receivable_invoices`: `client_id`, `gstin`, `revision`, `tally_mismatch` and
     `source`.
   - Then a backfill:
     - it creates one client per distinct client name on each sheet, using the partner most of
       that client's invoices carry;
     - it links every invoice to its client.
2. **`0059_drop_bank_credits`** cannot be undone.
   - It drops the foreign key from `receivable_firas.bank_credit_id`, then drops `bank_credits`
     and its rows.
   - Take an RDS snapshot first, for example `vcfo-suite-db-pre-0058-<date>`.

`receivable_reminders` stays, unused. It can be dropped in a later migration.

## New env vars (App Runner)

| Var | Value |
|---|---|
| `DOUBLETICK_API_KEY` | The DoubleTick account key, the same one LCC uses. Put it in Secrets Manager. |
| `DOUBLETICK_FROM_NUMBER` | The firm's WhatsApp number on DoubleTick (+91 90140 79600 in LCC's notes). |
| `DOUBLETICK_TEMPLATE_RECEIVABLES_EMAIL_SENT` | The approved template name for the ping. Create it in DoubleTick with four placeholders, and a body that does not start or end with one. Example: `Email "{{1}}" was sent from your Outlook to {{2}} ({{3}}) about {{4}}. – VCFO Suite` |
| `DOUBLETICK_BASE_URL` | Empty (the default is `https://public.doubletick.io`). |
| `DOUBLETICK_TEMPLATE_LANG` | `en` |
| `WHATSAPP_PROVIDER` | `aws` (the default) leaves the rest of the app as it is; `doubletick` moves every WhatsApp notification to DoubleTick. |
| `RECEIVABLES_EXTERNAL` | Leave it unset. `on` brings back partner logins, the portal, share links and publish alerts. |

The roll-up and digest are Inngest crons, so `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` must be
set and Inngest synced for them to run. Without Inngest:

- approval emails and pings still go, through `after()`;
- statements and retries always use `after()`.

## Decisions (summary)

- **Data.**
  - Each automatic email is sent once per period, enforced by one unique `dedupe_key`.
  - The log keeps the HTML, so Retry sends the same message.
  - A client's partner change moves its invoices too.
- **Approval.**
  - `no_partner` applies only to rows that would be NEW.
  - SAME clears ⚑ Fix in Tally when the file is staged.
  - The sheet's amount cell is read-only: every change goes through approval.
  - Credit days are edited once per client in the panel.
- **Hiding.**
  - "Pause reminders" is gone.
  - "Next reminder" became "Invoice date".
  - Share this view is hidden with Links.
  - The SBC note reply email is gated with the partner portal.
- **Emails.**
  - The token `brand` is purple, so the SBC orange is `highlight` / `highlight-bright`.
  - The body is a plain page, not `renderEmailDocument`.
  - Without Inngest, sends fall back to `after()`.
  - The roll-up interval counts from the last roll-up.
  - The digest is one email to all recipients.
  - There is no mailbox fallback.
  - Retry sends from the clicker's Outlook.
- **WhatsApp.**
  - The DoubleTick client is ported from LCC.
  - Settings are env vars, not a keychain dialog; `DOUBLETICK_FROM_NUMBER` and a template var were
    added.
  - The ping needs only a valid number, not the client opt-in.

## Not finished, and why

- **Phases 2 to 7 are not committed.** The permission classifier refused `git commit`.
- **No sample file.** `docs/specs/receivables/samples/Sales_Register.xlsx` was not on the machine,
  so the parser was built from the brief's description and has not been run against a real export.
  The first item in the checklist below covers this.
- **Tests and the browser were not used**, per the brief. No new test files were written.
- **The DoubleTick ping template does not exist yet** in DoubleTick. It must be created and approved
  there (see the env table above). Until then the ping is plain text, which arrives only inside
  WhatsApp's 24-hour window.
- **The hidden partner portal is untouched.** It still reads `receivable_reminders` for its history.

## Testing checklist for the owner

Do these in order on a local database: `npm run infra:up`, `npm run db:migrate`, `npm run db:seed`,
then `npm run dev`. Put the Tally sample at `docs/specs/receivables/samples/Sales_Register.xlsx`.
That folder is git-ignored.

1. **Migration.**
   - Run `npm run db:migrate` on a copy that has Summit's 43 invoices.
   - Check that `receivable_clients` has one row per client name.
   - Check that every invoice has a `client_id`.
2. **Tabs.**
   - Open `/receivables/manager`. The tabs should read Sheet │ People │ Versions │ Reports │ FX, with
     no From bank, Reminders, Partners or Links.
   - The filter bar has no "Share this view".
3. **Partners first.** On People ▸ Client partners, add two partners (name and email).
4. **Upload.**
   - On Sheet, click Import from Tally and pick the sample.
   - The toast should count the rows (162 vouchers, 29 clients).
   - The Awaiting approval panel should appear, with all rows under "No client partner yet" except
     those matching existing invoices.
5. **Matching.**
   - Rows whose voucher number is already on the sheet should show SAME (greyed) or CHANGED (old →
     new).
   - Edit one invoice number to `SCSPL/26-27/0164` style. It must still match `…/164`.
6. **Approve.**
   - Pick a partner for two clients. Their rows should tick themselves.
   - Change one client's credit days. The due dates should move.
   - Click Approve.
   - The rows leave the panel and the invoices appear on the sheet, in their months, with the
     Partner column filled.
7. **Re-upload.**
   - Upload the same file again. The approved rows should now be SAME.
   - Click Discard upload. The panel closes and nothing changes.
8. **Change amount.**
   - On an open invoice, use the row menu ▸ Change amount, with a new amount and a reason.
   - It appears in the panel as CHANGED (staff).
   - Approve it. The row shows `r1` and ⚑ Fix in Tally.
   - The Fix in Tally filter button shows 1 and filters to it.
   - History shows the amount before and after.
9. **Paid lock.**
   - Mark an invoice received, then try Change amount. The dialog should say to reopen the payment
     first.
   - A CHANGED Tally row for a received invoice is refused with that message on Approve.
10. **Fix in Tally clears.** Edit the sample's Gross Total for that voucher to the new amount and
    upload it. The row is SAME, and the ⚑ flag is gone from the sheet.
11. **Clients.**
    - On People ▸ Clients, set a partner, credit days, a billing email and a CC.
    - In Manage clients on a partner, tick three clients and save. Their invoices move to that
      partner on the sheet.
12. **Outlook.** Connect Outlook from the People tab or the header.
13. **Email A.**
    - On People, turn on "New invoice emails" and the partner's "New / revised email".
    - Approve a new Tally row.
    - With Inngest running (`npm run inngest:dev`) or without it, the log shows a New invoice email
      Sent from your mailbox.
    - The email is plain white, with the orange table, no link, and "Regards, <you> · SBC".
14. **Email A′.** Turn on "Revised invoice emails", then approve a staff change. The partner gets
    "Invoice revised", showing old → new and the reason.
15. **Email B.**
    - Turn on Roll-up every 3 days at the current hour (or earlier).
    - On the developer Jobs page, run `receivables-rollup`.
    - Each partner with open invoices gets one email: clients as headings, a table and a total
      each, and overdue amounts in red.
    - Run it again. Nothing new is sent (once per day).
16. **Email C.**
    - Add a digest recipient.
    - Turn on the weekly digest for today's weekday at an hour already past.
    - Run `receivables-leadership-digest`. One email arrives: partner ▸ client ▸ table, totals per
      partner, and the overall total.
17. **Email D.** On Clients, click Send statement. The client's billing email and CC get one table
    of its open invoices. Nothing is sent automatically.
18. **No Outlook.**
    - Disconnect Outlook and run the roll-up for a new day (or approve with A on).
    - The log shows Failed · Outlook not connected.
    - Reconnect, click Retry, and the row turns Sent.
19. **WhatsApp.**
    - Set `DOUBLETICK_API_KEY` and `DOUBLETICK_FROM_NUMBER`, and add your number in Account
      settings.
    - The People tab card shows Configured and your number.
    - Message the firm's number from your phone, then click Send test message within 24 hours. It
      arrives.
20. **Ping.**
    - With the template env set (or within the 24-hour window), send any of A to D.
    - Your WhatsApp gets "Email '<subject>' was sent from your Outlook to <name> (<email>) about …",
      and the log's WhatsApp column shows Sent.
    - Clear your phone number: the next one shows No phone. Unset the key: it shows Off.
21. **Hidden routes.** With `RECEIVABLES_EXTERNAL` unset, `/receivables`, `/receivables/login` and
    `/api/receivables/partner/me` answer 404. With `RECEIVABLES_EXTERNAL=on`, the Links tab and
    Share this view come back.
22. **Bad file.** Upload a real old-format `.xls`. It should fail with "Export from Tally as Excel
    (.xlsx)". A random `.xlsx` should fail with "not a Tally Sales Register".
23. **Gate.** Run `npm run check`, then `npm run e2e:smoke`. Fix anything the removed tabs broke in
    `e2e/receivables.spec.ts`.
