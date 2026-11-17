# Receivables v2 — decisions taken during the build

The owner's brief (`RECEIVABLES-TALLY-BUILD-BRIEF.md`) said to decide instead of asking. One line each: question, choice, reason.

## Phase 1 — data model

- Send hour for the roll-up: reuse `reminderRules.sendHourIst` or add a column? Added `receivable_sheets.send_hour_ist` (default 9), because the reminder rules are removed in Phase 4 and a plain column is clearer.
- Once-per-period key on `receivable_email_log`: `(kind, partner_id, period_key)` or one text key? One nullable unique `dedupe_key` (for example `rollup:<partner id>:<date>`, `digest:<sheet id>:<date>`), because Postgres treats a null `partner_id` as distinct and the digest has no partner; manual sends leave it null.
- What the email log keeps: the rendered HTML and text too, so Retry sends exactly the same message without rebuilding it.
- Existing invoices have no `client_id`: migration 0058 backfills one client per distinct client name on each sheet (the same key rule as `clientKey()`, in SQL), taking the partner most of that client's invoices carry, and links the invoices.
- Changing a client's partner (edit or "Manage clients") also moves that client's live invoices to the new partner, so the sheet and the emails agree.
- The import repository (`imports.ts`) was written in Phase 1 together with the other new repositories, since Phase 1 asks for the repository functions of every new table.

## Phase 2 — Tally import and approval

- `no_partner` applies only to rows that would be NEW. A CHANGED row matches an invoice that already has (or lacks) a partner; it stays CHANGED, and its revised email is simply not sent when there is no partner.
- SAME rows clear "Fix in Tally" when the upload is staged, not at approval, because SAME rows are greyed and never ticked. Staging also links a pre-v2 invoice to its client when the row is SAME.
- Approving a NO PARTNER row without picking a partner refuses that row with the code `no_partner`; the other rows are approved.
- A NEW row whose voucher number already exists on the sheet by approval time (added by hand meanwhile) is refused with `already_exists`.
- Amount changes are logged with the field `amountInr` (not `amount`), because the history drawer's `changeValue()` formats `amountInr` as rupees.
- `paid_locked` is a 409, since the request is valid but the invoice's state forbids it.
- Phases 2 and 3 share one commit: the Sheet tab wires the approval panel and the Change amount dialog together, and neither half compiles alone.
- The in-place amount cell on the sheet is now read-only for INR invoices. Every amount change goes through "Change amount" and the approval panel, as the brief's flow says; otherwise an edit would bypass approval, the revision and the revised email.
- Credit days are edited once per client in the approval panel (a box in the client's header), because they are a client setting; changing them moves the due dates of that client's new rows unless a row's due date was edited by hand.
- "Fix in Tally" is the sheet's own filter (`fix=1` in the URL), not part of a shared view's `ShareFilters`, so share links keep their meaning. The button shows only while some invoice carries the flag.
- The `r<revision>` badge sits beside the invoice number; the ⚑ Fix in Tally chip sits in the status stack. The table already had a partner column; its heading now reads "Partner".
- The approval panel groups rows by the partner picked in the panel when one is picked, so a NO PARTNER client moves under its new partner before approval.

## Phase 4 — People tab, removals and hiding

- The "Pause reminders" row action, the bulk pause and the pause dialogs were taken off the sheet, because there are no reminders left to pause. The pause route and column stay (harmless, and the hidden partner portal still reads them).
- The "Next reminder" column became "Invoice date" (and "Invoiced" on the phone cards).
- `hitFromRow` (the label of an old reminder row) moved into `partner-portal.ts` as a private helper, because the hidden partner portal still lists reminders sent before v2 and `reminder-rule.ts` was removed.
- `PartnerLogin.tsx` is no longer used by any tab but was kept, as the brief says not to delete the partner-facing code.
- `RECEIVABLES_EXTERNAL` gates: every partner route (`app/api/receivables/partner/*`, `partners/:id/login`), share links (`share-links`, `sheets/:id/share-links`, `public/receivables/share/:token/export`), `public/receivables/set-password`, the partner pages (`/receivables`, `/login`, `/account`, `/set-password`, `/statement`, `/s/:token`), the publish alerts in `publishSheet`, and the SBC note reply email (it links to the partner portal). The manager page passes the flag as a prop, so the browser bundle never reads the env var.
- "Share this view" on the filter bar is hidden with the Links tab, since it makes a share link.
- Links to the tool were removed from the receivables summary email ("Live view") and the FX rate alert email ("Open the FX tab"). The partner login and reply emails keep their links: they exist only to reach the partner portal and go only with `RECEIVABLES_EXTERNAL=on`.
- `receivable_firas.bank_credit_id` loses its foreign key but keeps its values, because dropping `bank_credits` should not erase which FIRA came from which credit. The FX desk now labels every receipt "Entered by hand".
- Migration 0059 drops the constraint before the table, so it runs cleanly (drizzle-kit generated the reverse order, which would fail).
- Test updates: the reminder and bank-credit blocks of `src/db/repositories/receivables.test.ts` were deleted with the code they tested; `fx-desk.test.ts` now asserts the alert email has no "Open the FX tab" link. The test files of the removed modules (`bank-feed/*.test.ts`, `match.test.ts`, `reminder-rule.test.ts`, `send-reminders.test.ts`, `send-now-route.test.ts`, `digest.test.ts`) went with them.

## Phase 5 — emails

- Colours: the design token `brand` is the app's purple (#635bff), not orange. The SBC orange in the tables is `highlight` (#b54708, text-safe with white bold text) for the header fill and `highlight-bright` (#f26b1d) for the outer edge and the total rule; the light band is #fff7ee.
- The email body is a plain page of its own in `email-v2.ts`, not `renderEmailDocument`, which always draws the coloured wash band and footer.
- Inngest event keys are not set on App Runner (see STATE.md, "Receivables Send answers at once"). So `queueApprovalEmails` and `queueSenderPing` send the Inngest event and, if that throws, run the same work in `after()`. The hourly roll-up and digest are Inngest crons and run only once Inngest is connected.
- Roll-up timing: "every `rollup_every_days` days" counts from the last roll-up that went out (in the email log), and a missed send hour still sends later the same day. The digest sends on its weekday from its hour on. Both are hourly jobs (:05 and :10 IST).
- The leadership digest is one email with every active recipient in To (one log row), not one email per recipient.
- A new invoice email (A) and a revised email (A′) share the partner's one switch `notify_new_invoice` ("New / revised invoice email" in the UI), but each has its own sheet switch, as the brief lists three sheet switches.
- Dedupe keys: `new_invoice:<partner>:<first invoice id>`, `revised:<invoice>:r<revision>`, `rollup:<partner>:<date>`, `digest:<sheet>:<date>`.
- Disputed invoices are left out of the roll-up and the digest, as they were left out of the old reminders.
- No Outlook: the email is logged `failed` with `outlook_not_connected` (or `outlook_reconnect` when the refresh failed); there is no mailbox fallback. A sheet with no manager logs `no_sender`.
- Retry sends the stored HTML again from the clicker's Outlook (the row's sender becomes the clicker), because the original sender may be away and their Outlook is not reachable from a request.
- Email D's subject and greeting are formal ("Dear Sir or Madam") since it goes to the client.

## Phase 6 — WhatsApp (DoubleTick)

- Found the owner's repository at `~/Documents/lcc` (Litigation Command Center). The DoubleTick client is `src-tauri/src/notify/whatsapp.rs` (decision D-120, notes of 23 Oct 2026). Ported: base URL, raw-key `Authorization`, the template call (`messages[]` with positional placeholders), the flat plain-text call, and the error wording (401/403 key refused, 429 rate limit, `status: FAILED` with `errorMessage`). Not ported: the media upload and the template listing, which receivables does not need.
- LCC's "Connect DoubleTick" dialog stores the key in the desktop keychain. A web app on App Runner keeps secrets in env vars (Secrets Manager), so the brief's env vars are the setting. The People tab card shows whether they are set (the names of missing vars only), the person's own number with a link to Account settings, and "Send test message".
- DoubleTick needs a `from` number, which the brief did not list: added `DOUBLETICK_FROM_NUMBER`. Also added `DOUBLETICK_TEMPLATE_LANG` and `DOUBLETICK_TEMPLATE_RECEIVABLES_EMAIL_SENT`, because WhatsApp delivers plain text only within 24 hours of the person's last message (LCC learnt this); the ping falls back to plain text without the template.
- The ping goes to the sender's own `profiles.phone_e164` and needs only a valid number, not the client WhatsApp opt-in, because it is a staff member's own notice.
- `WHATSAPP_PROVIDER=doubletick` routes `sendWhatsAppTemplate` through DoubleTick using the event's approved template name and its variables in order. The default `aws` changes nothing. The receivables ping uses DoubleTick whenever it is configured, whatever the provider.
- The test message is plain text (as LCC's Send test is), so it arrives only inside the 24-hour window.

## Commits

- Only the Phase 1 commit (`d82a1b19`) went through. Every later `git commit` was refused by the Claude Code permission classifier, so Phases 2 to 7 are in the working tree, uncommitted. The removals are staged (`git rm`); the new and changed files are not.
