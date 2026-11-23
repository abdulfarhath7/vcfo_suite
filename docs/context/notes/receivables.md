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
  receivables update, as a separate section. It is typed or pasted in the Send email pop-up
  (the "Security deposits (separate section)" block at the bottom), never stored in the database.
  "Add this section to the leaders' email" is off each time the pop-up opens; any edit turns it on.
- **Remembered per browser.** The last rows of a sheet sit in `localStorage` under
  `vcfo:rcv-deposits:<sheet id>`, so next week the person edits them. "Clear the rows" forgets them.
  Another browser or a private window starts empty.
- **Paste.** `parseDepositsPaste` reads tab-separated rows (Excel, Outlook), chat tables with `|`,
  and cells split by two or more spaces. A header row (first cell "Client"), a total row (empty first
  cell, or "Total" / "(total)") and rule rows are left out. `parseAmountInr` takes "₹ 3,00,00,000",
  "30,000,000", "Rs. 30000000" or "INR 5,00,000"; "7.7cr" is not an amount, so the row is marked and
  Send waits until it is fixed or emptied.
- **Leaders only.** The section exists only on the leaders' email of the receivables update. The
  pop-up shows it in the email as a block that cannot be edited in place, between comment markers
  `<!--deposits-->` and `<!--/deposits-->`. The send route throws that block away and draws the
  section again from the `deposits` it checked, so a body without `deposits` in the request never
  carries the section. `summaryEmailHtml` never draws it when `partnerSlug` is set, and the
  Collections report refuses `deposits`.

