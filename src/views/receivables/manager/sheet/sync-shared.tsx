'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { toastSuccess } from '@/lib/toast-errors';
import { call } from '@/hooks/use-receivables';
import { pendingKey } from '@/hooks/use-receivables-v2';
import type { PendingImportsDto } from '@/lib/receivables/v2-wire';
import type { TallyJobDto, TallyJobType } from '@/lib/receivables/tally-live/wire';
import { cn } from '@/lib/utils';
import { DatePick } from './DatePick';

/**
 * The parts every Sync button on the Sheet tab shares (SourceSync: Tally or Zoho Books): the
 * period dialog, and what happens when a sync ends (the approval panel refreshes and opens, or the
 * reason is shown with "Import Excel instead").
 */

export const TYPE_LABEL: Record<TallyJobType, string> = { sales: 'Invoices', receipts: 'Payments' };

/** 1 April of the financial year `today` falls in. */
export function financialYearStart(today: string): string {
  const y = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= 4 ? `${y}-04-01` : `${y - 1}-04-01`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * Follows one sync job and, when it ends, refreshes the source's status, opens the approval panel
 * with a summary toast (done) or hands the job to `onFailed`. `sourceWord` is "Tally" or "Zoho Books".
 */
export function useSyncFinish({
  sheetId,
  job,
  statusKey,
  sourceWord,
  onReview,
  onFailed,
  onSettled,
}: {
  sheetId: string;
  job: TallyJobDto | undefined;
  statusKey: QueryKey;
  sourceWord: string;
  onReview: () => void;
  onFailed: (j: TallyJobDto) => void;
  onSettled: () => void;
}) {
  const qc = useQueryClient();
  const finished = useRef<string | null>(null);
  useEffect(() => {
    const j = job;
    if (!j || j.status === 'queued' || j.status === 'running' || finished.current === j.id) return;
    finished.current = j.id;
    onSettled();
    void qc.invalidateQueries({ queryKey: statusKey });
    if (j.status === 'done') {
      void (async () => {
        await qc.invalidateQueries({ queryKey: pendingKey(sheetId) });
        const pending = await qc.fetchQuery({ queryKey: pendingKey(sheetId), queryFn: () => call<PendingImportsDto>(`/api/receivables/sheets/${sheetId}/imports/pending`) });
        const invoices = pending.rows.filter((r) => r.kind !== 'same' && r.kind !== 'receipt').length;
        const payments = pending.rows.filter((r) => r.kind === 'receipt').length;
        // The job's notes carry the reasons (a payment with no invoice, payments already applied).
        const notes = j.stats?.notes?.length ? ` ${j.stats.notes.slice(0, 3).map((n) => (/[.!?]$/.test(n) ? n : `${n}.`)).join(' ')}${j.stats.notes.length > 3 ? ' …' : ''}` : '';
        if (!invoices && !payments) {
          toastSuccess(`${sourceWord} is in step with the sheet`, `Nothing new for ${j.from} to ${j.to}.${notes}`);
          return;
        }
        const parts = [invoices ? plural(invoices, 'invoice') : '', payments ? plural(payments, 'payment') : ''].filter(Boolean);
        const skipped = j.stats?.skipped ? `${j.stats.skipped} record(s) from ${sourceWord} were skipped.` : '';
        toastSuccess(`${parts.join(' and ')} waiting for approval`, `${skipped}${notes}`.trim() || undefined);
        onReview();
      })();
    } else {
      onFailed(j);
    }
  }, [job, qc, sheetId, statusKey, sourceWord, onReview, onFailed, onSettled]);
  /** Call when a new job starts, so its end is noticed again. */
  return () => {
    finished.current = null;
  };
}

export function SyncDialog({
  title,
  type,
  today,
  busy,
  sub,
  copy,
  onType,
  onClose,
  onSync,
}: {
  title: string;
  type: TallyJobType;
  today: string;
  busy: boolean;
  sub?: string;
  copy: Record<TallyJobType, string>;
  onType: (t: TallyJobType) => void;
  onClose: () => void;
  onSync: (input: { type: TallyJobType; from: string; to: string }) => void;
}) {
  const [from, setFrom] = useState(() => financialYearStart(today));
  const [to, setTo] = useState(today);
  const valid = Boolean(from && to && from <= to);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      sub={sub || undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || busy} onClick={() => onSync({ type, from, to })}>
            {busy ? 'Starting…' : `Sync ${TYPE_LABEL[type].toLowerCase()}`}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div role="radiogroup" aria-label="What to fetch" className="inline-flex w-fit rounded-md border border-line p-0.5">
          {(['sales', 'receipts'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => onType(t)}
              className={cn('rounded px-3 py-1 text-[12.5px]', type === t ? 'bg-surface-sunken font-semibold text-ink' : 'text-ink-muted hover:bg-hover')}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="sync-from">
            <DatePick id="sync-from" label="Sync from" value={from} max={to || undefined} quick={[]} onChange={setFrom} />
          </Field>
          <Field label="To" htmlFor="sync-to">
            <DatePick id="sync-to" label="Sync to" value={to} min={from || undefined} quick={[0]} onChange={setTo} />
          </Field>
        </div>
        <p className="text-[12.5px] text-ink-muted">{copy[type]}</p>
      </div>
    </Modal>
  );
}

/** The end of a sync that did not finish: the reason, and the Excel import as the way out. */
export function SyncFailedModal({ job, fallback, onClose, onImportExcel }: { job: TallyJobDto; fallback: string; onClose: () => void; onImportExcel: () => void }) {
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="The sync did not finish"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              onClose();
              onImportExcel();
            }}
          >
            Import Excel instead
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-2">{job.error ?? fallback}</p>
    </Modal>
  );
}
