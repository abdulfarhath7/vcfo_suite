# Receivables: Tally live sync (T1)

Status: built locally on 25 Nov 2026, not deployed. Scope T1 is Summit's one sheet, the types
`sales` (invoices) and `receipts` (payments), and a Sync button only. Nothing runs on a schedule.

## How it works

The cloud app cannot reach a TallyPrime on an office PC, so a small connector on that PC calls out
(`tools/tally-connector/`). Staff press **Sync from Tally** on the Sheet tab, which queues a job.
The connector's long-poll picks it up, asks TallyPrime on `localhost:9000` for the vouchers of the
period (export requests only), and posts them back. VCFO maps them and stages them in the same
**Awaiting approval** panel as the Excel import. Nothing reaches an invoice until someone approves.

| Part | Where |
|---|---|
| Tables | `tally_connectors`, `tally_sync_jobs` (migration `0070_tally_live_sync`, additive); new columns `receivable_import_batches.source/kind`, `receivable_import_rows.received_on/receipt_no/receipt_ref` |
| Repository | `src/db/repositories/receivables/tally-sync.ts`; staging in `imports.ts` (`stageTallyImport` with `source: 'tally_live'`, `stageTallyReceipts`, receipt rows in `approveImportRows`) |
| Mappers | `src/lib/receivables/tally-live/map.ts` (pure), wire types in `wire.ts` |
| Connector API | `app/api/tally/connector/{pair,hello,jobs,jobs/[id]/result}` (no session; bearer token) |
| Staff API | `app/api/receivables/sheets/[id]/tally/{route,pair,revoke,sync,jobs/[jobId]}` |
| UI | `src/views/receivables/manager/sheet/TallySync.tsx`, `src/hooks/use-tally-sync.ts`, PAYMENT rows in `sheet/ApprovalPanel.tsx` |

## The contract with the connector (fixed)

- **Pair.** Staff make a pairing code on the Sheet tab (8 characters, valid 10 minutes, shown once;
  only its sha256 is stored). The connector sends `POST /api/tally/connector/pair` with JSON
  `{code, name, version, tallyCompany}` and gets `200 {token, sheetName}`. The token is
  `tc_` + 32 random bytes in base64url; only its sha256 is stored. A new pairing revokes the sheet's
  older connector. A wrong, used or expired code gets `400 {error: 'invalid_code'}`.
- Every other call sends `Authorization: Bearer <token>`. An unknown or revoked token gets
  `401 {error: 'revoked'}`.
- **`GET /api/tally/connector/jobs`**: a long-poll of up to 45 s that checks the database every 3 s
  and stops as soon as a job is found. It updates `last_seen_at`. It answers
  `200 {job: {id, type: 'sales'|'receipts', from: 'YYYY-MM-DD', to: 'YYYY-MM-DD'}}` (the job is
  now `running`) or `204`. Queued jobs older than 2 minutes expire with the error "The Tally PC did
  not answer. Is it on, with the connector running?".
- **`POST /api/tally/connector/jobs/:id/result`**: JSON, plain or `Content-Encoding: gzip`, at most
  20 MB as sent (100 MB unpacked). Either `{ok: false, error}` or
  `{ok: true, company, vouchers: Voucher[]}`, where
  `Voucher = {guid, voucherType, voucherNo, date: 'YYYY-MM-DD', partyName, gstin?, amount /* positive INR */, bills?: [{name, amount}]}`.
  Optional additions (connector 0.2.0, 25 Nov 2026; an older connector leaves them out and is read
  as before): `Voucher.direction?: 'debit'|'credit'` is the side of the party ledger entry, and
  each bill may carry `direction?: 'debit'|'credit'`, `billType?: 'New Ref'|'Agst Ref'|'Advance'|'On Account'`
  and `creditPeriod?: string` (as Tally writes it, for example "30 Days"). `amount` stays positive
  on the voucher and on every bill; the side is only in `direction`. Tally writes a debit as a
  negative amount (or with "(-)") and a credit as a positive one, so a normal sale is `debit`
  (receivable up) and a normal receipt `credit` (receivable down). An on-account or advance
  allocation may have an empty `name`. An unknown `billType` is dropped, not refused.
  Answers `200 {staged}`. A body that cannot be read fails the job and answers `400 invalid_body`.
- **`POST /api/tally/connector/hello`**: `{version, tallyCompany, tallyReachable}` → `200 {ok: true}`.
  Updates `last_seen_at` and the status the Sheet tab shows.

## Mapping

- **Invoices.** A voucher whose type contains "Sales" (not "Sales Return"), not cancelled, becomes
  a Sales Register row: invoice no. = voucher no., client = party name, the same `voucherKey` and
  matching as the Excel import, so the rows are NEW, CHANGED, SAME, MATCHED or NO PARTNER as today.
- **Payments.** A voucher whose type contains "Receipt" gives one PAYMENT row per bill-wise
  reference; the bill name is the invoice number. A receipt with no named bill is skipped with
  "No bill reference in Tally" (listed in the job's notes). A payment already applied by an earlier
  sync (same voucher guid and invoice) is left out.
- **Sides and bill types** (only when the connector sends them). A Sales voucher that credits the
  party (a return entered as Sales) is left out with a warning. A Receipt that debits the party,
  or a bill debited on a receipt, is skipped with "Reversal entry in Tally". An `On Account` or
  `Advance` bill is skipped with "On account payment in Tally (no invoice)". `Agst Ref` bills
  match an invoice by name; `New Ref` bills are matched by name too, as before.
- **Approving a payment** calls `markReceived`: less than the open balance is a part payment, the
  rest settles the invoice. An invoice that is not on the sheet (`receipt_no_invoice`) or is
  already received (`receipt_received`) is refused and the row stays, with the reason shown.
- Invoices and payments are separate pending batches: a new invoices sync or Excel upload replaces
  only the pending invoices batch, a new payments sync only the pending payments batch.

## Setup at Summit (owner and accountant)

1. On the Tally PC: TallyPrime, F1 Help, Settings, Connectivity, "TallyPrime acts as" Server, port 9000.
2. Install and start the VCFO Tally Connector on that PC (`tools/tally-connector/README.md`).
3. On the Sheet tab: Sync from Tally ▾, Connect Tally…, and type the code into the connector.
4. Before deploy: apply migration `0070_tally_live_sync` on RDS (additive).

## Limits (T1)

- One connector per sheet, one sync at a time per sheet (a partial unique index enforces it).
- No schedule; a period is at most 400 days. A running job that sends nothing for 10 minutes fails.
- Payments in INR only, as Tally keeps them; a foreign invoice is settled by its INR amount.
- Receipts on account (no bill reference) are not applied; credit notes, the outstanding check,
  client masters and reports are T2/T3.
- The pairing code has no attempt limit beyond its 10-minute life (31^8 codes); the connector
  routes have no rate limit yet.
- The long-poll holds a server request for up to 45 s per connector; App Runner allows 120 s.
