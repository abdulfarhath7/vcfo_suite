'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { addDaysIso, monthLong, sheetDate } from '@/lib/receivables/dates';
import { isForeign, realisedFx } from '@/lib/receivables/fx';
import type { InvoiceInput, Partner, ReceiptInput, SheetInvoice } from '@/lib/receivables/model';
import { fc, fcText, inr, parseInr, rateText, signedInr } from '../format';
import { FxFields } from './FxFields';
import { draftIsForeign, fxDraftOf, fxFigures, fxPayload, useDraftRate } from './fx-draft';
import { ForwardPicker } from './fx/ForwardPicker';
import { DatePick } from './sheet/DatePick';

/**
 * The dialogs of the Sheet tab: Mark received, Pause reminders and Add invoice (the Edit FX
 * dialog is in FxFields.tsx). Mark received on a foreign invoice asks for the foreign amount
 * received and the INR credited, previews the realised gain or loss and the bank charges, and may
 * deliver the receipt against an open forward contract of that currency (Phase 10); on an INR
 * invoice it takes the dollars received, if the client paid in dollars (owner, 19 Nov 2026).
 */

type Busy = { busy: boolean; error: string | null };

const SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
const parseFc = (t: string) => Number(t.replace(/[^0-9.]/g, ''));
/** How far the worked-out rate may be from the reference rate before the amber check shows. */
const RATE_CHECK = 0.03;

/**
 * An amount box with its currency at the left, inside the box, the way a phone number box shows
 * its country code (owner, 19 Nov 2026). The currency is fixed; it opens nothing. Commas are put
 * in when the box is left. `estimated` shows a worked-out value in grey italics until it is typed over.
 */
function AmountBox({
  id,
  currency,
  value,
  onChange,
  invalid,
  estimated,
  label,
}: {
  id: string;
  currency: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  estimated?: boolean;
  label: string;
}) {
  const inrBox = currency === 'INR';
  const tidy = () => {
    const n = inrBox ? parseInr(value) : parseFc(value);
    if (value.trim() && Number.isFinite(n) && n > 0) onChange(inrBox ? inr(n) : fc(n));
  };
  return (
    <div
      className={`flex h-9 items-stretch overflow-hidden rounded-md border-1.5 bg-surface-raised focus-within:border-brand focus-within:ring-4 focus-within:ring-focus-ring/25 ${invalid ? 'border-danger' : 'border-line-strong'}`}
    >
      <span aria-hidden className="grid w-10 flex-none place-items-center border-r border-line bg-surface-sunken text-[14px] font-medium text-ink-2">
        {SYMBOL[currency] ?? currency}
      </span>
      <input
        id={id}
        aria-label={`${label}, in ${currency}`}
        aria-invalid={invalid}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={tidy}
        className={`min-w-0 flex-1 bg-transparent px-2.5 text-[13.5px] tabular-nums outline-none ${estimated ? 'italic text-ink-muted' : 'text-ink'}`}
      />
      {estimated ? <span className="flex-none self-center pr-2.5 text-[11.5px] text-ink-muted">estimated</span> : null}
    </div>
  );
}

/**
 * Mark received (owner, 19 Nov 2026): two fixed boxes, INR credited by the bank and the dollars
 * received. On an INR invoice the USD box is optional; on a foreign invoice its own currency comes
 * first and is needed. With both filled the rate is INR ÷ USD; with only the foreign amount the INR
 * is estimated from the reference rate until it is typed over. A rate far from the reference shows
 * an amber check but never stops Save. No TDS box.
 */
export function MarkReceivedDialog({
  sheetId,
  invoice,
  partnerName,
  today,
  refRate,
  onClose,
  onSave,
  state,
}: {
  /** The sheet, for the forward contract picker of a foreign invoice. */
  sheetId?: string;
  invoice: SheetInvoice;
  partnerName: string;
  today: string;
  /** The reference rate in force: of the invoice's currency, or of USD on an INR invoice. */
  refRate?: { rate: number; rateDate: string } | null;
  onClose: () => void;
  onSave: (input: ReceiptInput) => void;
  state: Busy;
}) {
  const foreign = isForeign({ currency: invoice.currency ?? 'INR' });
  const cur = foreign ? (invoice.currency ?? 'USD').toUpperCase() : 'USD';
  const [paidOn, setPaidOn] = useState(today);
  const [inrText, setInrText] = useState(foreign ? '' : inr(invoice.amountInr));
  const [inrTyped, setInrTyped] = useState(false);
  const [fcTextIn, setFcTextIn] = useState(foreign && invoice.fcAmount ? fc(invoice.fcAmount) : '');
  const [part, setPart] = useState(false);
  const [forwardId, setForwardId] = useState('');

  const fcValue = fcTextIn.trim() ? parseFc(fcTextIn) : 0;
  const ref = refRate?.rate && refRate.rate > 0 ? refRate.rate : null;
  // Only the foreign amount typed: the INR is worked out from the reference rate until it is typed.
  const estimate = fcValue > 0 && !inrTyped && ref ? Math.round(fcValue * ref) : null;
  const inrValue = estimate ?? parseInr(inrText);
  const shownInr = estimate !== null ? inr(estimate) : inrText;
  const rate = fcValue > 0 && inrValue > 0 ? inrValue / fcValue : null;
  const off = rate && ref ? (rate - ref) / ref : null;

  const badAmount = !(inrValue > 0);
  const badFc = foreign ? !(fcValue > 0) : Boolean(fcTextIn.trim()) && !(fcValue > 0);
  const bad = badAmount || badFc;
  const realised = foreign ? realisedFx({ fcAmount: invoice.fcAmount ?? null, invoiceRate: invoice.fxRate ?? null, receivedFc: fcValue || null, receivedInr: inrValue || null }) : null;
  const fcDue = fcText(invoice);
  const save = () =>
    onSave(
      foreign
        ? { paidOn, amount: inrValue, part, receivedFc: fcValue, receivedCurrency: cur, ...(forwardId ? { forwardId } : {}) }
        : { paidOn, amount: inrValue, part, ...(fcValue > 0 ? { receivedFc: fcValue, receivedCurrency: 'USD' } : {}) },
    );
  const changeInr = (v: string) => {
    setInrText(v);
    setInrTyped(true);
  };

  const inrBox = (
    <Field label="INR credited by bank" htmlFor="rcv-amount" error={badAmount && (inrText || !foreign) ? 'Enter an amount above zero.' : undefined}>
      <AmountBox id="rcv-amount" label="INR credited by bank" currency="INR" value={shownInr} onChange={changeInr} invalid={badAmount && Boolean(inrText || !foreign)} estimated={estimate !== null} />
      {estimate !== null ? <p className="mt-1 text-[12px] text-ink-muted">{`ⓘ From the reference rate ₹${rateText(ref)}. Change it to the bank advice.`}</p> : null}
    </Field>
  );
  const fcBox = (
    <Field
      label={foreign ? `Received in ${cur}` : 'Received in USD · optional'}
      htmlFor="rcv-fc"
      error={badFc && fcTextIn ? 'Enter an amount above zero.' : undefined}
      hint={foreign ? undefined : 'Fill in only when the client paid in dollars.'}
    >
      <AmountBox id="rcv-fc" label={`Received in ${cur}`} currency={cur} value={fcTextIn} onChange={setFcTextIn} invalid={badFc && Boolean(fcTextIn)} />
    </Field>
  );

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Mark received · ${invoice.clientName}${invoice.invoiceNo ? ` ${invoice.invoiceNo}` : ''}`}
      sub={`${fcDue ? `${fcDue} · ` : ''}₹${inr(invoice.amountInr)} due ${sheetDate(invoice.dueDate)} · ${partnerName}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={bad || state.busy} onClick={save}>
            {state.busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Paid on" htmlFor="rcv-paid-on">
          <DatePick id="rcv-paid-on" label="Paid on" value={paidOn} max={today} onChange={setPaidOn} quick={[0]} />
        </Field>
        {/* The invoice's own currency first: INR on an INR invoice, the foreign amount on a foreign one. */}
        {foreign ? (
          <>
            {fcBox}
            {inrBox}
          </>
        ) : (
          <>
            {inrBox}
            {fcBox}
          </>
        )}
        {rate !== null ? (
          off !== null && Math.abs(off) > RATE_CHECK ? (
            <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
              {`⚠ Rate ₹${rateText(rate)} per ${SYMBOL[cur] ?? cur} is ${Math.round(Math.abs(off) * 100)}% ${off < 0 ? 'below' : 'above'} the reference ₹${rateText(ref)}. Check the two amounts.`}
            </p>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-surface-sunken px-3 py-2 text-[12.5px]">
              <dt className="text-ink-muted">Rate</dt>
              <dd className="text-right tabular-nums">
                {`₹${rateText(rate)} per ${SYMBOL[cur] ?? cur}`}
                {ref ? <span className="text-ink-muted">{` · reference ₹${rateText(ref)}${off !== null ? ` · ${off >= 0 ? '+' : '−'}${Math.abs(off * 100).toFixed(2)}%` : ''}`}</span> : null}
              </dd>
              {realised ? (
                <>
                  <dt className="text-ink-muted">Booked rate</dt>
                  <dd className="text-right tabular-nums">{`₹${rateText(invoice.fxRate)}`}</dd>
                  <dt className="text-ink-muted">Realised {realised.realisedInr < 0 ? 'loss' : 'gain'}</dt>
                  <dd className={`text-right tabular-nums ${realised.realisedInr < 0 ? 'text-danger' : 'text-positive'}`}>{signedInr(realised.realisedInr)}</dd>
                  <dt className="text-ink-muted">Bank charges</dt>
                  <dd className="text-right tabular-nums">{realised.bankChargesFc > 0 ? `${cur} ${fc(realised.bankChargesFc)} (₹${inr(realised.bankChargesInr)})` : 'None'}</dd>
                </>
              ) : null}
            </dl>
          )
        ) : null}
        {foreign && !invoice.fxRate ? <p className="text-[12.5px] text-ink-muted">No booked rate on this invoice, so the gain or loss cannot be worked out.</p> : null}
        {foreign && sheetId ? <ForwardPicker sheetId={sheetId} currency={cur} value={forwardId} onChange={setForwardId} receivedFc={fcValue > 0 ? fcValue : null} /> : null}
        <fieldset className="grid gap-2 text-[13px]">
          <legend className="sr-only">Payment kind</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="rcv-kind" checked={!part} onChange={() => setPart(false)} /> Full payment
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="rcv-kind" checked={part} onChange={() => setPart(true)} /> Part payment, keep the balance open
          </label>
        </fieldset>
        <p className="text-[12.5px] text-ink-muted">
          {foreign
            ? 'A small difference (bank charges, rate) still counts as full payment. An awaited FIRA is added on the Reports tab.'
            : 'A small difference (bank charges, rate) still counts as full payment.'}
        </p>
        {state.error ? (
          <p role="alert" className="text-[12.5px] text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export function PauseDialog({
  invoice,
  today,
  onClose,
  onSave,
  state,
}: {
  invoice: SheetInvoice;
  today: string;
  onClose: () => void;
  onSave: (input: { until: string | null; reason: string | null }) => void;
  state: Busy;
}) {
  const [until, setUntil] = useState(invoice.remindersPausedUntil ?? addDaysIso(today, 7));
  const [reason, setReason] = useState(invoice.pauseReason ?? '');
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Pause reminders · ${invoice.clientName}${invoice.invoiceNo ? ` ${invoice.invoiceNo}` : ''}`}
      size="sm"
      footer={
        <>
          {invoice.remindersPausedUntil ? (
            <Button variant="quiet" className="mr-auto" disabled={state.busy} onClick={() => onSave({ until: null, reason: null })}>
              Resume now
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!until || state.busy} onClick={() => onSave({ until, reason: reason.trim() || null })}>
            Pause
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="No reminders until" htmlFor="rcv-until">
          <DatePick id="rcv-until" label="No reminders until" value={until} min={today} onChange={setUntil} quick={[7, 15, 30]} />
        </Field>
        <Field label="Reason" htmlFor="rcv-reason" hint="For example: client promised payment by 10 Nov.">
          <Input id="rcv-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <p className="text-[12.5px] text-ink-muted">A pause changes reminders only. The client page does not show it, so it needs no Update.</p>
        {state.error ? (
          <p role="alert" className="text-[12.5px] text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export function AddInvoiceDialog({
  sheetId,
  months,
  partners,
  clients,
  today,
  onClose,
  onSave,
  state,
}: {
  sheetId: string;
  months: string[];
  partners: Partner[];
  clients: string[];
  today: string;
  onClose: () => void;
  onSave: (input: InvoiceInput) => void;
  state: Busy;
}) {
  const thisMonth = `${today.slice(0, 7)}-01`;
  const choices = [...new Set([...months, thisMonth])].sort();
  const [clientName, setClientName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [partnerId, setPartnerId] = useState(partners.find((p) => p.active)?.id ?? '');
  const [invoiceMonth, setInvoiceMonth] = useState(months.at(-1) ?? thisMonth);
  const [dueDate, setDueDate] = useState(addDaysIso(today, 30));
  const [amount, setAmount] = useState('');
  const [fx, setFx] = useState(() => fxDraftOf(null, today));
  const stored = useDraftRate(sheetId, fx);
  const figures = fxFigures(fx, stored);
  const value = draftIsForeign(fx) ? (figures.bookedInr ?? NaN) : parseInr(amount);
  const ok = clientName.trim() && value > 0 && dueDate && figures.ok;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add invoice"
      sub="It goes into the draft; the client page shows it after Update."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!ok || state.busy}
            onClick={() =>
              onSave({ clientName: clientName.trim(), invoiceNo: invoiceNo.trim() || null, partnerId: partnerId || null, invoiceMonth, dueDate, amountInr: value, ...fxPayload(fx, stored) })
            }
          >
            Add to draft
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Client" htmlFor="rcv-client">
          <Input id="rcv-client" list="rcv-client-names" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <datalist id="rcv-client-names">
            {clients.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Invoice number" htmlFor="rcv-no" hint="Optional.">
          <Input id="rcv-no" value={invoiceNo} maxLength={40} onChange={(e) => setInvoiceNo(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Client partner" htmlFor="rcv-partner">
          <select id="rcv-partner" className="h-10 rounded-md border-1.5 border-line-strong bg-surface-raised px-3 text-[14px]" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">No partner yet</option>
            {partners
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Invoice month" htmlFor="rcv-month">
            <select id="rcv-month" className="h-10 rounded-md border-1.5 border-line-strong bg-surface-raised px-3 text-[14px]" value={invoiceMonth} onChange={(e) => setInvoiceMonth(e.target.value)}>
              {choices.map((m) => (
                <option key={m} value={m}>
                  {monthLong(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" htmlFor="rcv-due">
            <DatePick id="rcv-due" label="Due date" value={dueDate} onChange={setDueDate} quick={[15, 30, 45, 60]} />
          </Field>
        </div>
        <FxFields draft={fx} onChange={setFx} stored={stored} idPrefix="rcv-add" />
        {fx.currency === 'INR' ? (
          <Field label="Amount (INR)" htmlFor="rcv-amt">
            <Input id="rcv-amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
          </Field>
        ) : null}
        {state.error ? (
          <p role="alert" className="text-[12.5px] text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
