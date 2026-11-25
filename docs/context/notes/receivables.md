# Receivables — gotchas

Spec: `docs/specs/receivables/PLAN.md` (v1) and `docs/specs/receivables/V2.md` (v2, which wins).

## Tally Sales Register (v2 import)

- **The `.xls` is really xlsx.** Tally names its Excel export `.xls`, but the bytes are a zip
  (`PK\x03\x04`). The parser checks the bytes, not the name. A true BIFF `.xls` (it starts
  `D0 CF 11 E0`) is refused with `not_xlsx`. ExcelJS cannot read BIFF.
- **The ledger columns change between exports.** After the fixed columns (Date, Particulars,
  Buyer, Consignee, Voucher Type, Voucher No., GSTIN/UIN, PAN No., Value, Gross Total) come any
  number of ledger columns: fees, CGST/SGST/IGST, TDS, Reimbursement-*. Their set and order change
  with what was billed in the period. Columns are found by header text, never by position, and the
  ledger columns are ignored.
- **The header row moves.** Rows 1 to 11 hold the company, addresses, GSTINs and the period, and
  the address lines vary. The column row is the one with the cell "Voucher No.".
- **Voucher numbers can have leading zeros.** `SCSPL/26-27/0164` and `SCSPL/26-27/164` are the same
  invoice. Matching uses `voucherKey()`, which drops leading zeros in each number. The number is
  stored exactly as Tally wrote it.
- **No unique key on `invoice_no`.** Matching is done in code against the sheet's live invoices, as
  `scripts/provision-summit-receivables.ts` does.
- The last row is "Grand Total" in Particulars. Rows whose Voucher Type is not "Sales" are skipped.

## Emails and WhatsApp (v2)

- Inngest event keys are not set on App Runner. `queueApprovalEmails` and `queueSenderPing` try the
  Inngest event first, then fall back to `after()` from next/server. The hourly roll-up and digest
  crons need Inngest to be connected to run at all.
- The design token `brand` is purple (#635bff). The SBC orange in the email tables is `highlight` /
  `highlight-bright` from `spectrum-email-tokens.ts`.
- DoubleTick sends plain text only within 24 hours of the person's last message to the firm's
  number. The receivables ping needs an approved template (`DOUBLETICK_TEMPLATE_RECEIVABLES_EMAIL_SENT`)
  to arrive reliably. DoubleTick refuses a template body that starts or ends with a placeholder.
- Non-strict TypeScript: narrow `{ ok: true } | { ok: false }` results with `res.ok === false`.
  `!res.ok` does not narrow without `strictNullChecks`.

## Security deposits section (receivables update, 23 Nov 2026)

- **Where it comes from.** The leaders want the weekly list of client security deposits in the
  receivables update, as a separate section. The rows are a saved table of their own on the Sheet
  tab, under the invoices (`receivable_deposits`, migration 0067; Save replaces the whole table).
  The first two builds of the day kept them in the Send email pop-up and in the browser; that form
  is gone. The pop-up only has a tick box on the leaders' email to leave the section out.
- **The request never carries rows.** Send email sends `withDeposits: true|false`; the route reads
  the saved rows itself. The summary GET returns them as `deposits` for the preview.
- **Total row.** The sum and the crore figure ("7.70 cr"); a total under one lakh shows no crore
  figure, so it never reads "0.00 cr" (owner, 23 Nov 2026).
- **Columns.** Client, Status, ETA for closure, Total SD in INR and SD due now/post signing, as in
  the table the leadership pasted on 23 Nov 2026. "Client name, amount, remarks" in their WhatsApp
  message was shorthand; a three-column build that evening was wrong and never reached RDS.
- **Paste.** `parseDepositsPaste` reads tab-separated rows (Excel, Outlook), chat tables with `|`,
  and cells split by two or more spaces. A header row (first cell "Client"), a total row (empty first
  cell, or "Total" / "(total)") and rule rows are left out. `parseAmountInr` takes "₹ 3,00,00,000",
  "30,000,000", "Rs. 30000000" or "INR 5,00,000"; "7.7cr" is not an amount, so the row is marked and
  Save waits until it is fixed or emptied.
- **Leaders only.** The section exists only on the leaders' email of the receivables update. The
  pop-up shows it in the email as a block that cannot be edited in place, between comment markers
  `<!--deposits-->` and `<!--/deposits-->`. The send route throws that block away and draws the
  section again from the `deposits` it checked, so a body without `deposits` in the request never
  carries the section. `summaryEmailHtml` never draws it when `partnerSlug` is set, and the
  Collections report refuses `deposits`. Partners and other people still get the receivables update,
  without the section: the route puts it only in a whole-sheet email whose every To and Cc address
  is an active leader of the sheet (`mayCarryDeposits`), and answers 400 `deposits_leaders_only`
  when any other email holds the block. The pop-up stops the send while someone who is not a leader
  is on the leaders' email. "Only to leaders" in the leadership's message of 23 Nov 2026 was about
  this section, not about the receivables update.


## Tally live sync (T1, 25 Nov 2026)

- Spec and contract: `docs/specs/receivables/TALLY-LIVE.md`. The connector routes under
  `/api/tally/connector/*` have no session; `proxy.ts` does not match `/api`, so they need no
  allowlist. Tokens and pairing codes are stored only as sha256.
- `markReceived` writes with `db`, not a transaction, so `approveImportRows` applies PAYMENT rows
  after its own transaction, claiming each row (pending → approved) first and putting it back when
  the payment is refused.
- Invoices and payments are separate pending batches (`receivable_import_batches.kind`); the
  approval panel lists every pending batch with its own Discard button (`PendingImportsDto.batches`).
- The connector may send `null` for `name`, `version` and `tallyCompany`; the schemas accept it.
