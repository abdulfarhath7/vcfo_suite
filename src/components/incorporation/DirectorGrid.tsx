'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { LayoutGrid, Rows3 } from 'lucide-react';
import type { ChecklistField } from '@/data/checklist';
import { cn } from '@/lib/utils';

/** One column of the grid: a director field template. */
export type DirectorGridColumn = { id: string; label: string; field: ChecklistField };

/** One row: a director, with the response key of each of its cells. */
export type DirectorGridRow = {
  key: string;
  title: string;
  badge?: ReactNode;
  cellKey: (columnId: string) => string;
  /** False when the cell's question is hidden for this director (its `showWhen`). */
  shown: (columnId: string) => boolean;
};

export type DirectorView = 'cards' | 'grid';

const VIEW_KEY = 'vcfo.director-view';

/** The Cards / Grid choice, kept per browser. */
export function useDirectorView(): [DirectorView, (next: DirectorView) => void] {
  const [view, setView] = useState<DirectorView>('cards');
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === 'grid') setView('grid');
    } catch {
      /* storage blocked: cards */
    }
  }, []);
  const set = (next: DirectorView) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage blocked: the choice lasts this visit */
    }
  };
  return [view, set];
}

/** CD-03: the "Cards / Grid" control. */
export function DirectorViewToggle({ view, onChange }: { view: DirectorView; onChange: (next: DirectorView) => void }) {
  const option = (value: DirectorView, label: string, Icon: typeof Rows3) => (
    <button
      type="button"
      role="radio"
      aria-checked={view === value}
      onClick={() => onChange(value)}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
        view === value ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Director view" className="inline-flex rounded-md bg-surface-sunken p-0.5">
      {option('cards', 'Cards', Rows3)}
      {option('grid', 'Grid', LayoutGrid)}
    </div>
  );
}

const CELL = 'h-8 w-full min-w-[150px] rounded-[5px] border border-line bg-surface px-2 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:bg-surface-sunken disabled:text-ink-muted';

function Cell({ field, value, disabled, label, onChange }: {
  field: ChecklistField;
  value: string;
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'file') {
    return <span className={cn('text-[12.5px]', value ? 'text-positive' : 'text-ink-muted')}>{value ? 'Uploaded' : 'Upload in Cards view'}</span>;
  }
  if ((field.type === 'select' || field.type === 'segmented') && field.options) {
    return (
      <select aria-label={label} className={CELL} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      aria-label={label}
      className={CELL}
      type={field.type === 'date' ? 'date' : 'text'}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * CD-03 / SB-02: the directors side by side, one row each and one column per question. The grid
 * edits the same answers as the cards, so the two views always agree, and the same validation
 * runs on Submit. The name column stays in view while the grid scrolls sideways; Tab moves along
 * the row. Part A and Part B both use this one component.
 */
export function DirectorGrid({ rows, columns, values, readOnly, errors, onChange }: {
  rows: DirectorGridRow[];
  columns: DirectorGridColumn[];
  values: Record<string, string | undefined>;
  readOnly: (cellKey: string) => boolean;
  errors?: Record<string, string | undefined>;
  onChange: (cellKey: string, value: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-line" data-testid="director-grid">
      <table className="w-max min-w-full border-collapse text-left">
        <thead>
          <tr className="bg-surface-sunken">
            <th scope="col" className="sticky left-0 z-10 min-w-[180px] border-b border-r border-line bg-surface-sunken px-3 py-2 text-[12px] font-semibold text-ink-muted">
              Director
            </th>
            {columns.map((col) => (
              <th key={col.id} scope="col" className="border-b border-line px-2 py-2 text-[12px] font-semibold text-ink-muted">
                {col.label}
                {col.field.required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-line-soft last:border-b-0">
              <th scope="row" className="sticky left-0 z-10 border-r border-line bg-surface-raised px-3 py-1.5 align-top">
                <span className="block text-[13px] font-medium text-ink">{row.title}</span>
                {row.badge ? <span className="mt-1 block">{row.badge}</span> : null}
              </th>
              {columns.map((col) => {
                const key = row.cellKey(col.id);
                if (!row.shown(col.id)) {
                  return <td key={col.id} className="px-2 py-1.5 text-[12px] text-ink-muted" aria-label={`${col.label}: not asked`}>·</td>;
                }
                const error = errors?.[key];
                return (
                  <td key={col.id} className="px-2 py-1.5 align-top">
                    <Cell
                      field={col.field}
                      label={`${col.label} · ${row.title}`}
                      value={values[key] ?? ''}
                      disabled={readOnly(key)}
                      onChange={(v) => onChange(key, v)}
                    />
                    {error ? <p className="mt-0.5 max-w-[200px] text-[11.5px] text-danger">{error}</p> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
