'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChecklistField } from '@/data/checklist';
import { showWhenMatches } from '@/lib/checklist/checklist-repeat';
import { parseDirectorCount } from '@/lib/checklist/checklist-pre1-validation';
import { DirectorGrid, DirectorViewToggle, useDirectorView } from '@/components/incorporation/DirectorGrid';

export const PRE1_DIRECTOR_MIN = 1;
export const PRE1_DIRECTOR_MAX = 4;

const SLOT_PARTS = ['FirstName', 'MiddleName', 'LastName', 'Gender', 'IndiaResident'] as const;

/** Every Part A answer kept for one director slot. */
export function pre1DirectorSlotFieldIds(n: number): string[] {
  return SLOT_PARTS.map((part) => `director${n}${part}`);
}

/**
 * The next Part A answers when the director count changes: the count itself, and the answers of
 * every slot that is no longer shown cleared, so a removed director never reaches the board
 * resolution.
 */
export function withDirectorCount(prev: Record<string, string>, next: number): Record<string, string> {
  const count = Math.min(PRE1_DIRECTOR_MAX, Math.max(PRE1_DIRECTOR_MIN, next));
  const out: Record<string, string> = { ...prev, directorCount: String(count) };
  for (let n = count + 1; n <= PRE1_DIRECTOR_MAX; n += 1) {
    for (const id of pre1DirectorSlotFieldIds(n)) if (out[id]) out[id] = '';
  }
  return out;
}

/**
 * CD-02: remove director `k` (1-based) and give the cards after it new numbers in sequence, so
 * "Director 3" becomes "Director 2". The last card cannot be removed.
 */
export function withDirectorRemoved(prev: Record<string, string>, k: number, count: number): Record<string, string> {
  if (count <= PRE1_DIRECTOR_MIN || k < 1 || k > count) return prev;
  const out: Record<string, string> = { ...prev };
  for (let n = k; n < count; n += 1) {
    for (const part of SLOT_PARTS) out[`director${n}${part}`] = prev[`director${n + 1}${part}`] ?? '';
  }
  return withDirectorCount(out, count - 1);
}

/** The slot has any answer typed into it. */
export function directorSlotHasData(values: Record<string, string>, n: number): boolean {
  return pre1DirectorSlotFieldIds(n).some((id) => (values[id] ?? '').trim());
}

/** The slot has every required answer: first and last name, gender and residence. */
export function directorSlotComplete(values: Record<string, string>, n: number): boolean {
  return ['FirstName', 'LastName', 'Gender', 'IndiaResident'].every((part) => (values[`director${n}${part}`] ?? '').trim());
}

/**
 * CD-01, CD-02: Part A's proposed directors as one collapsible card per director, with no "how many"
 * question. The section opens with "Director 1"; "+ Add director" adds a card below the last one,
 * up to four; every card but the last can be removed (with a confirmation when it holds answers),
 * and the cards after it are renumbered. A closed card keeps its answers and shows the director's
 * name and whether the card is complete. The minimum (two for a private company) is checked when
 * the section is submitted. Answers stay in the same `directorCount` and `director{n}*` keys.
 */
export function DirectorCards({
  count,
  values,
  error,
  disabled,
  renderSlot,
  onChange,
}: {
  count: number;
  values: Record<string, string>;
  /** The submit-time error, such as the minimum number of directors. */
  error?: string;
  disabled?: boolean;
  /** The fields of one director, rendered by the form. */
  renderSlot: (n: number) => ReactNode;
  onChange: (next: Record<string, string>) => void;
}) {
  const [closed, setClosed] = useState<Record<number, boolean>>({});
  const [confirm, setConfirm] = useState<number | null>(null);

  const remove = (n: number) => {
    onChange(withDirectorRemoved(values, n, count));
    setConfirm(null);
    setClosed({});
  };

  return (
    <div className="grid gap-3">
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
        const open = !closed[n];
        const name = [values[`director${n}FirstName`], values[`director${n}LastName`]].map((v) => (v ?? '').trim()).filter(Boolean).join(' ');
        const complete = directorSlotComplete(values, n);
        return (
          <section key={n} className="rounded-lg border-1.5 border-line bg-surface-raised" aria-label={`Director ${n}`}>
            <header className="flex min-w-0 items-center gap-2 px-3 py-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={open}
                onClick={() => setClosed((c) => ({ ...c, [n]: open }))}
              >
                <ChevronDown className={cn('h-4 w-4 flex-none text-ink-muted transition-transform', !open && '-rotate-90')} aria-hidden />
                <span className="text-[14px] font-medium text-ink">Director {n}</span>
                {name ? <span className="min-w-0 truncate text-[13px] text-ink-muted">· {name}</span> : null}
              </button>
              <span
                className={cn(
                  'flex-none rounded-sm px-1.5 py-0.5 text-[11.5px] font-medium',
                  complete ? 'bg-positive-soft text-positive' : 'bg-surface-sunken text-ink-muted',
                )}
              >
                {complete ? 'Complete' : 'Incomplete'}
              </span>
              {count > PRE1_DIRECTOR_MIN && !disabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove director ${n}`}
                  onClick={() => (directorSlotHasData(values, n) ? setConfirm(n) : remove(n))}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
            </header>
            {confirm === n ? (
              <div role="alertdialog" aria-label={`Remove director ${n}?`} className="flex flex-wrap items-center gap-2 border-t border-line-soft bg-warning-soft/60 px-3 py-2 text-[13px]">
                <span className="text-ink">Remove director {n} and the answers typed for them?</span>
                <Button type="button" size="sm" variant="destructive" onClick={() => remove(n)}>
                  Remove
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                  Keep
                </Button>
              </div>
            ) : null}
            <div hidden={!open} className="grid gap-x-4 gap-y-3 border-t border-line-soft px-3 py-3 md:grid-cols-2">
              {renderSlot(n)}
            </div>
          </section>
        );
      })}
      {error ? <p className="text-[12px] font-medium text-danger">{error}</p> : null}
      {count < PRE1_DIRECTOR_MAX && !disabled ? (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange(withDirectorCount(values, count + 1))}>
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          Add director
        </Button>
      ) : null}
    </div>
  );
}

/**
 * CD-03: Part A's directors with the Cards / Grid switch. The grid edits the same flat
 * `director{n}…` answers as the cards, through the same setter, so both views agree.
 */
export function Pre1DirectorsView({
  fields,
  values,
  errors,
  isCellReadOnly,
  onCellChange,
  cards,
}: {
  fields: ChecklistField[];
  values: Record<string, string>;
  errors?: Record<string, string | undefined>;
  isCellReadOnly: (cellKey: string) => boolean;
  onCellChange: (cellKey: string, value: string) => void;
  cards: ReactNode;
}) {
  const [view, setView] = useDirectorView();
  const count = parseDirectorCount(values);
  const byId = new Map(fields.map((f) => [f.id, f]));
  const columns = fields
    .filter((f) => /^director1[A-Z]/.test(f.id) && f.id !== 'director1Din')
    .map((f) => {
      const label = f.label.replace(/^Director \d+ — /, '');
      return { id: f.id.slice('director1'.length), label: label.charAt(0).toUpperCase() + label.slice(1), field: f };
    });
  const rows = Array.from({ length: count }, (_, i) => i + 1).map((n) => {
    const name = [values[`director${n}FirstName`], values[`director${n}LastName`]].map((v) => (v ?? '').trim()).filter(Boolean).join(' ');
    return {
      key: String(n),
      title: name ? `Director ${n} · ${name}` : `Director ${n}`,
      cellKey: (col: string) => `director${n}${col}`,
      shown: (col: string) => {
        const field = byId.get(`director${n}${col}`);
        if (!field) return false;
        // The slot's own rule (director 2 shows when there are two or more) is the row itself.
        if (!field.showWhen || field.showWhen.field === 'directorCount') return true;
        return showWhenMatches(field.showWhen, values[field.showWhen.field]);
      },
    };
  });
  return (
    <div className="grid gap-3">
      <DirectorViewToggle view={view} onChange={setView} />
      {view === 'grid' ? (
        <DirectorGrid rows={rows} columns={columns} values={values} readOnly={isCellReadOnly} errors={errors} onChange={onCellChange} />
      ) : (
        cards
      )}
    </div>
  );
}
