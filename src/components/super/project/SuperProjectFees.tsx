'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Button } from '@/components/ui/button';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { Cols, Col } from '@/components/ui/cols';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FilterSelect } from '@/components/ui/native-select';
import { plainDay, todayKey } from '@/components/super/parts/super-text';
import { outstandingOf, rupees } from '@/lib/fees/outstanding';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/**
 * FEES TAB of the super admin client record (P-100, prototype `ClientRecordScreen` "Fees"): a
 * "Fees by service" grid and an "Outstanding" card, both from `engagement_fees`
 * (`/api/engagements/:id/fees`). A line is added or changed in a small dialog; nothing is shown
 * that the firm did not enter.
 */

type Billing = 'one_time' | 'monthly' | 'milestone';
type Status = 'not_billed' | 'billed' | 'paid';

interface Fee {
  id: string;
  service: string;
  amountRupees: number;
  billing: Billing;
  status: Status;
  billedOn: string | null;
  paidOn: string | null;
}

const BILLING_WORD: Record<Billing, string> = {
  one_time: 'One time',
  monthly: 'Monthly, in advance',
  milestone: '50% on start, 50% on completion',
};
const STATUS_WORD: Record<Status, string> = { not_billed: 'Not billed', billed: 'Billed', paid: 'Paid' };
const STATUS_TONE: Record<Status, ChipTone> = { not_billed: 'idle', billed: 'warn', paid: 'ok' };

async function feesFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

export function SuperProjectFees({ engagementId }: { engagementId: string }) {
  const base = `/api/engagements/${encodeURIComponent(engagementId)}/fees`;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['engagement-fees', engagementId],
    queryFn: () => feesFetch<{ fees: Fee[] }>(base).then((b) => b.fees),
  });
  const [editing, setEditing] = useState<Fee | 'new' | null>(null);

  const fees = query.data ?? [];
  const due = outstandingOf(fees, todayKey());
  const total = fees.reduce((sum, fee) => sum + fee.amountRupees, 0);

  const columns: EFilingColumn<Fee>[] = [
    { key: 'service', header: 'Service', render: (f) => <span className="font-medium text-ink">{f.service}</span> },
    {
      key: 'fee',
      header: 'Fee',
      width: '140px',
      align: 'right',
      render: (f) => (
        <span className="tabular-nums">
          {rupees(f.amountRupees)}
          {f.billing === 'monthly' ? <span className="text-ink-muted"> a month</span> : null}
        </span>
      ),
    },
    { key: 'billing', header: 'Billing', render: (f) => BILLING_WORD[f.billing] },
    {
      key: 'status',
      header: 'Status',
      width: '124px',
      render: (f) => (
        <Chip fixed tone={STATUS_TONE[f.status]} title={f.paidOn ? `Paid ${plainDay(f.paidOn)}` : f.billedOn ? `Billed ${plainDay(f.billedOn)}` : undefined}>
          {STATUS_WORD[f.status]}
        </Chip>
      ),
    },
  ];

  return (
    <Cols>
      <Col>
        <DashSection
          title="Fees by service"
          meta={fees.length ? rupees(total) : undefined}
          loading={query.isPending}
          right={
            <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
              <Plus aria-hidden />
              Add fee
            </Button>
          }
          bodyClassName="px-2 pb-2 pt-1"
        >
          {query.isError ? (
            <EmptyState
              title="Fees could not load"
              action={
                <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <EFilingGrid
              caption="Fees by service"
              columns={columns}
              rows={fees}
              rowKey={(f) => f.id}
              onRowClick={(f) => setEditing(f)}
              pageSize={25}
              minWidth={560}
              empty="No fees yet"
            />
          )}
        </DashSection>
      </Col>
      <Col>
        <DashSection title="Outstanding" loading={query.isPending}>
          {due ? (
            <dl className="grid gap-2.5 text-[13.5px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Amount</dt>
                <dd className={cn('font-medium tabular-nums', due.days > 60 ? 'text-danger' : 'text-ink')}>{rupees(due.amountRupees)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Outstanding for</dt>
                <dd className="tabular-nums text-ink">{due.days} days</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Ageing</dt>
                <dd className="text-ink">{due.bucket}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-[13.5px] text-ink-muted">Nothing outstanding</p>
          )}
        </DashSection>
      </Col>
      {editing ? (
        <FeeDialog
          key={editing === 'new' ? 'new' : editing.id}
          fee={editing === 'new' ? null : editing}
          base={base}
          onClose={() => setEditing(null)}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ['engagement-fees', engagementId] })}
        />
      ) : null}
    </Cols>
  );
}

function FeeDialog({
  fee,
  base,
  onClose,
  onSaved,
}: {
  fee: Fee | null;
  base: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [service, setService] = useState(fee?.service ?? '');
  const [amount, setAmount] = useState(fee ? String(fee.amountRupees) : '');
  const [billing, setBilling] = useState<Billing>(fee?.billing ?? 'one_time');
  const [status, setStatus] = useState<Status>(fee?.status ?? 'not_billed');
  const [billedOn, setBilledOn] = useState(fee?.billedOn ?? '');
  const amountRupees = Number(amount.replace(/[,\s₹]/g, ''));
  const valid = service.trim().length > 0 && Number.isInteger(amountRupees) && amountRupees >= 0 && amount.trim() !== '';

  const save = useMutation({
    mutationFn: () =>
      feesFetch(fee ? `${base}/${fee.id}` : base, {
        method: fee ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          service: service.trim(),
          amountRupees,
          billing,
          status,
          billedOn: status === 'not_billed' ? null : billedOn || null,
          paidOn: status === 'paid' ? fee?.paidOn ?? null : null,
        }),
      }),
    onSuccess: () => {
      toastSuccess(fee ? 'Fee saved' : 'Fee added', service.trim());
      onSaved();
      onClose();
    },
    onError: (err) => toastError('Could not save the fee', errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: () => feesFetch(`${base}/${fee!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toastSuccess('Fee removed', fee?.service);
      onSaved();
      onClose();
    },
    onError: (err) => toastError('Could not remove the fee', errorMessage(err)),
  });

  const busy = save.isPending || remove.isPending;

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fee ? 'Edit fee' : 'Add fee'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) save.mutate();
          }}
        >
          <Field label="Service" htmlFor="fee-service">
            <Input id="fee-service" value={service} onChange={(e) => setService(e.target.value)} maxLength={120} required />
          </Field>
          <Field label="Fee in rupees" htmlFor="fee-amount">
            <Input id="fee-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="Billing" htmlFor="fee-billing">
            <FilterSelect
              id="fee-billing"
              size="md"
              className="w-full [&>select]:w-full"
              value={billing}
              onChange={(e) => setBilling(e.target.value as Billing)}
              options={(Object.keys(BILLING_WORD) as Billing[]).map((value) => ({ value, label: BILLING_WORD[value] }))}
            />
          </Field>
          <Field label="Status" htmlFor="fee-status">
            <FilterSelect
              id="fee-status"
              size="md"
              className="w-full [&>select]:w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              options={(Object.keys(STATUS_WORD) as Status[]).map((value) => ({ value, label: STATUS_WORD[value] }))}
            />
          </Field>
          {status !== 'not_billed' ? (
            <Field label="Billed on" htmlFor="fee-billed-on">
              <Input id="fee-billed-on" type="date" value={billedOn} onChange={(e) => setBilledOn(e.target.value)} />
            </Field>
          ) : null}
          <DialogFooter className="gap-2">
            {fee ? (
              <Button type="button" variant="quiet" className="mr-auto text-danger" disabled={busy} onClick={() => remove.mutate()}>
                Remove
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
