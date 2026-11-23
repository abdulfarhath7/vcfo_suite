'use client';

import { useEffect, useId, useState, type ClipboardEvent } from 'react';
import { ArrowUp, Plus, X } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DEPOSIT_LIMITS, amountProblem, croreLabel, depositsPayload, depositsTotal, depositsTotalLabel, emptyDraftRow, formatInr, parseAmountInr, parseDepositsPaste, type DepositDraftRow, type DepositRow } from '@/lib/receivables/deposits';
import { useDeposits, useSaveDeposits } from '@/hooks/use-receivables-v2';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/**
 * The sheet's security deposits (owner, 23 Nov 2026): a table of its own on the Sheet tab, under
 * the invoices, in the leadership's own columns: Client, Status, ETA for closure, Total SD in INR
 * and SD due now/post signing. The rows are saved on the sheet with Save. They
 * are for the leaders only: Send email puts them in the leaders' email as a separate section and
 * in no other email. The total is computed, never typed.
 */

const COLUMNS: Array<{ key: keyof DepositDraftRow; label: string; max: number; className: string }> = [
  { key: 'client', label: 'Client', max: DEPOSIT_LIMITS.cell, className: 'min-w-[140px]' },
  { key: 'status', label: 'Status', max: DEPOSIT_LIMITS.cell, className: 'min-w-[150px]' },
  { key: 'eta', label: 'ETA for closure', max: DEPOSIT_LIMITS.cell, className: 'min-w-[120px]' },
  { key: 'amount', label: 'Total SD in INR', max: 40, className: 'min-w-[140px] text-right tabular-nums' },
  { key: 'due', label: 'SD due now/post signing', max: DEPOSIT_LIMITS.due, className: 'min-w-[240px]' },
];

const toDraft = (rows: DepositRow[]): DepositDraftRow[] => rows.map((r) => ({ client: r.client, status: r.status, eta: r.eta, amount: r.totalInr === null ? '' : formatInr(r.totalInr), due: r.due }));
const same = (a: DepositDraftRow[], b: DepositDraftRow[]) => JSON.stringify(a) === JSON.stringify(b);

export function DepositsTable({ sheetId }: { sheetId: string }) {
  const id = useId();
  const saved = useDeposits(sheetId);
  const save = useSaveDeposits(sheetId);
  const [rows, setRows] = useState<DepositDraftRow[]>([]);
  const [base, setBase] = useState<DepositDraftRow[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState('');
  // The saved rows fill the table when they arrive and after each save.
  useEffect(() => {
    if (!saved.data) return;
    const next = toDraft(saved.data.rows);
    setRows(next);
    setBase(next);
  }, [saved.data]);

  const problems = rows.map((r, i) => ({ row: i + 1, text: r.amount.trim(), bad: amountProblem(r.amount) })).filter((p) => p.bad);
  const total = depositsTotal(rows.map((r) => ({ totalInr: parseAmountInr(r.amount) })));
  const dirty = !same(rows, base);
  const change = (i: number, key: keyof DepositDraftRow, value: string) => setRows(rows.map((r, n) => (n === i ? { ...r, [key]: value } : r)));
  const move = (i: number) => {
    if (i === 0) return;
    const next = [...rows];
    [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
    setRows(next);
  };
  const fill = (text: string) => {
    const { rows: parsed, dropped } = parseDepositsPaste(text);
    if (!parsed.length) {
      setNote('No rows found in the pasted text. Copy the table rows, one row per line, with the cells in the five columns: Client, Status, ETA for closure, Total SD in INR, SD due now/post signing.');
      return;
    }
    setRows(parsed);
    setPaste('');
    const bad = parsed.filter((r) => amountProblem(r.amount)).length;
    setNote(`${parsed.length} row${parsed.length === 1 ? '' : 's'} filled in.${dropped ? ` ${dropped} more left out: the table holds up to ${DEPOSIT_LIMITS.rows} rows.` : ''}${bad ? ` ${bad} amount${bad === 1 ? ' needs' : 's need'} fixing.` : ''} Click Save to keep them.`);
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') && !text.includes('\t')) return;
    e.preventDefault();
    fill(text);
  };
  const submit = () =>
    save.mutate(depositsPayload('', rows)?.rows ?? [], {
      onSuccess: (d) => toastSuccess('Security deposits saved', `${d.rows.length} row${d.rows.length === 1 ? '' : 's'}. They go in the leaders’ email only.`),
      onError: (e) => toastError('Not saved', e instanceof Error ? e.message : undefined),
    });

  return (
    <DashSection
      title="Security deposits"
      meta={saved.data ? `${base.length} row${base.length === 1 ? '' : 's'} · leaders only` : undefined}
      right={
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="quiet" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen} aria-controls={`${id}-paste-box`}>
            Paste a table
          </Button>
          <Button size="sm" variant="secondary" disabled={rows.length >= DEPOSIT_LIMITS.rows} onClick={() => setRows([...rows, emptyDraftRow()])}>
            <Plus aria-hidden /> Add row
          </Button>
          <Button size="sm" disabled={!dirty || problems.length > 0 || save.isPending} onClick={submit}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
      flush
      loading={saved.isLoading}
    >
      {saved.error ? <p className="px-4 py-4 text-[13px] text-danger">{saved.error.message}</p> : null}
      {pasteOpen ? (
        <div id={`${id}-paste-box`} className="grid gap-1 border-b border-line-soft px-4 py-3">
          <label htmlFor={`${id}-paste`} className="text-[12px] text-ink-muted">
            Paste a table copied from Excel, Outlook or a chat. The rows below are replaced; a header row and a total row are left out.
          </label>
          <div className="flex items-start gap-2">
            <Textarea id={`${id}-paste`} className="min-h-[56px] px-2 py-1 font-mono text-[12px]" value={paste} onChange={(e) => setPaste(e.target.value)} onPaste={onPaste} placeholder={'Client\tStatus\tETA for closure\tTotal SD in INR\tSD due now/post signing'} />
            <Button size="sm" variant="secondary" className="flex-none" disabled={!paste.trim()} onClick={() => fill(paste)}>
              Fill rows
            </Button>
          </div>
        </div>
      ) : null}
      {note ? (
        <p role="status" aria-live="polite" className="px-4 pt-2 text-[12px] text-ink-muted">
          {note}
        </p>
      ) : null}
      {saved.data && !rows.length ? (
        <p className="px-4 py-4 text-[13px] text-ink-muted">No security deposits yet. Click Add row, or paste a table. The leaders’ email gets this table as a separate section; no other email does.</p>
      ) : null}
      {rows.length ? (
        <div className="overflow-x-auto px-3 py-2">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-ink-muted">
                <th scope="col" className="w-7 px-1 py-1 font-medium">
                  <span className="sr-only">Row</span>
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className={cn('px-1 py-1 font-medium', c.key === 'amount' && 'text-right')}>
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="w-16 px-1 py-1">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line-soft">
                  <td className="px-1 py-1 text-ink-muted">{i + 1}</td>
                  {COLUMNS.map((c) => {
                    const bad = c.key === 'amount' && amountProblem(r.amount);
                    return (
                      <td key={c.key} className="px-1 py-1">
                        <Input
                          aria-label={`${c.label}, row ${i + 1}`}
                          aria-invalid={bad || undefined}
                          aria-describedby={bad ? `${id}-problems` : undefined}
                          inputMode={c.key === 'amount' ? 'decimal' : undefined}
                          className={cn('h-8 px-2 py-1 text-[13px]', c.className)}
                          value={r[c.key]}
                          maxLength={c.max}
                          onChange={(e) => change(i, c.key, e.target.value)}
                        />
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-1 py-1">
                    <button type="button" className="inline-grid h-6 w-6 place-items-center rounded text-ink-muted hover:bg-line hover:text-ink disabled:opacity-40" aria-label={`Move row ${i + 1} up`} disabled={i === 0} onClick={() => move(i)}>
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button type="button" className="ml-0.5 inline-grid h-6 w-6 place-items-center rounded text-ink-muted hover:bg-line hover:text-ink" aria-label={`Remove row ${i + 1}`} onClick={() => setRows(rows.filter((_, n) => n !== i))}>
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line-strong font-semibold">
                <td className="px-1 py-2" />
                <td colSpan={3} className="px-3 py-2">
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums" aria-live="polite">
                  {depositsTotalLabel(total)}
                </td>
                <td className="px-3 py-2">
                  {croreLabel(total)}
                  {dirty ? <span className="ml-3 text-[12px] font-normal text-ink-muted">Not saved yet.</span> : null}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
      {problems.length ? (
        <p id={`${id}-problems`} role="alert" className="px-4 pb-3 text-[12.5px] text-danger">
          {problems.map((p) => `Row ${p.row}: “${p.text}” is not an amount.`).join(' ')} Write the total deposit in rupees, for example 31,00,000 or 3100000, or leave it empty.
        </p>
      ) : null}
    </DashSection>
  );
}
