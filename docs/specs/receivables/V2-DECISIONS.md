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
