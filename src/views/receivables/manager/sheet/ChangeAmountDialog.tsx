'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { ManagerInvoiceDto } from '@/lib/receivables/wire';
import { inr, parseInr } from '../../format';
import { invoiceName } from './cell-utils';

/**
 * "Change amount" on a sheet row (docs/specs/receivables/V2.md, Phase 3). The new amount and a
 * reason (for example "Phani's email of 17 Nov") go to the approval panel; the invoice changes
 * only when someone approves. A received or part-paid invoice cannot change until its payment is
 * reopened, so the dialog says so instead of offering the form.
 */
export function ChangeAmountDialog({
  invoice,
  state,
  onClose,
  onSave,
}: {
  invoice: ManagerInvoiceDto;
  state: { busy: boolean; error: string | null };
  onClose: () => void;
  onSave: (input: { amountInr: number; reason: string }) => void;
}) {
  const [amount, setAmount] = useState(inr(invoice.amountInr));
  const [reason, setReason] = useState('');
  const locked = invoice.status !== 'open' || invoice.partPaid > 0;
  const value = parseInr(amount);
  const valid = Number.isFinite(value) && value > 0 && Math.round(value * 100) !== Math.round(invoice.amountInr * 100) && reason.trim().length > 0;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Change amount · ${invoiceName(invoice)}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {locked ? 'Close' : 'Cancel'}
          </Button>
          {locked ? null : (
            <Button disabled={!valid || state.busy} onClick={() => onSave({ amountInr: value, reason: reason.trim() })}>
              Send for approval
            </Button>
          )}
        </>
      }
    >
      {locked ? (
        <p className="text-[13px] text-ink-2">{`This invoice is ${invoice.status === 'open' ? 'part-paid' : 'received'}. Reopen the payment first, then change the amount.`}</p>
      ) : (
        <div className="grid gap-3">
          <p className="text-[12.5px] text-ink-muted">{`Today ₹${inr(invoice.amountInr)}${invoice.revision ? ` · revision r${invoice.revision}` : ''}. The change waits in Awaiting approval; once approved the invoice is marked "Fix in Tally" until a Tally upload shows the same amount.`}</p>
          <Field label="New amount ₹" htmlFor="rcv-new-amount">
            <Input id="rcv-new-amount" inputMode="decimal" className="font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Reason" htmlFor="rcv-change-reason" hint="For example: Phani's email of 17 Nov.">
            <Input id="rcv-change-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {state.error ? (
            <p role="alert" className="text-[12.5px] text-danger">
              {state.error}
            </p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
