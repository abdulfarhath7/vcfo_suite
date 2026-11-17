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
