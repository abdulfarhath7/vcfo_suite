'use client';

import { useId, useState, type ClipboardEvent } from 'react';
import { ArrowUp, ChevronDown, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DEPOSIT_LIMITS, amountProblem, depositsTotal, depositsTotalLabel, emptyDraftRow, parseAmountInr, parseDepositsPaste, type DepositDraftRow } from '@/lib/receivables/deposits';
import type { DepositsDraft } from './use-deposits-draft';
import { cn } from '@/lib/utils';

/**
 * The security deposits section of the receivables update (owner, 23 Nov 2026), in the Send email
 * pop-up. The person types the rows or pastes a table copied from Excel, Outlook or a chat; the
 * section goes into the leaders' email, after the receivables total, only when "Add this section"
 * is on and at least one row is filled in. Nothing is saved on the server; `useDepositsDraft`
 * keeps the rows and remembers them in this browser. The total is computed, never typed.
 */

const COLUMNS: Array<{ key: keyof DepositDraftRow; label: string; max: number; className: string }> = [
  { key: 'client', label: 'Client', max: DEPOSIT_LIMITS.cell, className: 'min-w-[140px]' },
  { key: 'status', label: 'Status', max: DEPOSIT_LIMITS.cell, className: 'min-w-[130px]' },
  { key: 'eta', label: 'ETA for closure', max: DEPOSIT_LIMITS.cell, className: 'min-w-[110px]' },
  { key: 'amount', label: 'Total SD (₹)', max: 40, className: 'min-w-[120px] text-right' },
  { key: 'due', label: 'SD due now / post signing', max: DEPOSIT_LIMITS.due, className: 'min-w-[200px]' },
];

export function DepositsSection({ draft }: { draft: DepositsDraft }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState('');
  const { title, rows, include, setTitle, setRows, setInclude, clear, problems, payload } = draft;
  const filled = payload?.rows.length ?? 0;
  const total = depositsTotal(rows.map((r) => ({ totalInr: parseAmountInr(r.amount) })));

  const fill = (text: string) => {
    const { rows: parsed, dropped } = parseDepositsPaste(text);
    if (!parsed.length) {
      setNote('No rows found in the pasted text. Copy the table rows, one row per line, with the cells in the five columns.');
      return;
    }
    setRows(parsed);
    setPaste('');
    const bad = parsed.filter((r) => amountProblem(r.amount)).length;
    setNote(
      `${parsed.length} row${parsed.length === 1 ? '' : 's'} filled in.${dropped ? ` ${dropped} more left out: the section holds up to ${DEPOSIT_LIMITS.rows} rows.` : ''}${bad ? ` ${bad} amount${bad === 1 ? ' needs' : 's need'} fixing.` : ''}`,
    );
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') && !text.includes('\t')) return;
    e.preventDefault();
    fill(text);
  };
  const change = (i: number, key: keyof DepositDraftRow, value: string) => setRows(rows.map((r, n) => (n === i ? { ...r, [key]: value } : r)));
  const move = (i: number) => {
    if (i === 0) return;
    const next = [...rows];
    [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
    setRows(next);
  };

  return (
    <section className="border-t border-line-soft" aria-labelledby={`${id}-head`}>
      <button
        id={`${id}-head`}
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-ink hover:bg-hover"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDown className={cn('h-4 w-4 flex-none transition-transform', open && 'rotate-180')} aria-hidden />
        <span>Security deposits (separate section)</span>
        <span className="ml-auto text-[12px] font-normal text-ink-muted">{include && filled ? `in the email · ${filled} row${filled === 1 ? '' : 's'}` : 'not in the email'}</span>
      </button>
      {open ? (
        <div id={`${id}-body`} className="grid gap-2.5 px-3 pb-3">
          <p className="text-[12px] text-ink-muted">
            Leaders only. The section goes after the receivables total, with its own heading and table. It is not saved on the sheet; this browser remembers the rows for next time.
          </p>
          <div className="flex items-center gap-2">
            <Checkbox id={`${id}-include`} checked={include} onCheckedChange={(v) => setInclude(v === true)} />
            <label htmlFor={`${id}-include`} className="text-[13px] text-ink">
              Add this section to the leaders’ email
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={`${id}-title`} className="flex-none text-[12px] text-ink-muted">
              Section title
            </label>
            <Input id={`${id}-title`} className="h-8 max-w-[360px] px-2 py-1 text-[13px]" value={title} maxLength={DEPOSIT_LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${id}-paste`} className="text-[12px] text-ink-muted">
              Paste a table copied from Excel, Outlook or a chat. The rows below are replaced; a header row and a total row are left out.
            </label>
            <div className="flex items-start gap-2">
              <Textarea id={`${id}-paste`} className="min-h-[56px] px-2 py-1 font-mono text-[12px]" value={paste} onChange={(e) => setPaste(e.target.value)} onPaste={onPaste} placeholder={'Client\tStatus\tETA for closure\tTotal SD\tSD due now / post signing'} />
              <Button size="sm" variant="secondary" className="h-8 flex-none px-2 text-[12.5px]" disabled={!paste.trim()} onClick={() => fill(paste)}>
                Fill rows
              </Button>
            </div>
            <p role="status" aria-live="polite" className="text-[12px] text-ink-muted">
              {note}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
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
              </tbody>
            </table>
          </div>
          {problems.length ? (
            <p id={`${id}-problems`} role="alert" className="text-[12.5px] text-danger">
              {problems.map((p) => `Row ${p.row}: “${p.text}” is not an amount.`).join(' ')} Write the total deposit in rupees, for example 31,00,000 or 3100000, or leave it empty. The email cannot go until this is fixed.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" className="h-7 px-2 text-[12.5px]" disabled={rows.length >= DEPOSIT_LIMITS.rows} onClick={() => setRows([...rows, emptyDraftRow()])}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
              Add row
            </Button>
            <Button size="sm" variant="quiet" className="h-7 px-2 text-[12.5px]" onClick={clear}>
              Clear the rows
            </Button>
            <p className="ml-auto text-[13px] text-ink" aria-live="polite">
              Total SD <b className="font-semibold tabular-nums">{depositsTotalLabel(total)}</b>
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
