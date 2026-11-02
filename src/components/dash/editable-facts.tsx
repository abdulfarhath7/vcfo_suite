'use client';

import { useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashSection } from '@/components/dash/DashSection';
import type { CardHeadTone } from '@/lib/ui/card-head-icon';

/**
 * Editable facts (prototype cards/EditableFacts): label and value rows in one or two columns.
 * With `editable`, an Edit button in the head turns each value into a 34px input; Save hands the
 * new rows to `onSave` (R-40: a plain setting saves on Save) and Cancel drops the draft. The
 * parent decides what Save means: a staff screen writes the value, a client screen sends a
 * change request to the lead (`factChangeNote` writes its text), since a client never writes a
 * step answer itself.
 */
export interface FactRow {
  /** The label, also the row key. */
  k: string;
  v: string;
  /** Identifier: mono (R-28). */
  mono?: boolean;
  /** Shown but not editable. */
  locked?: boolean;
}

export function EditableFacts({
  title,
  rows,
  editable,
  onSave,
  saving,
  meta,
  headIcon,
  cols = 2,
  saveLabel = 'Save',
  readOnlyNote,
}: {
  title: string;
  rows: FactRow[];
  /** Show the Edit button. */
  editable?: boolean;
  /** Called with the changed rows only, before and after. */
  onSave?: (changes: Array<{ k: string; before: string; after: string }>, next: FactRow[]) => void | Promise<void>;
  saving?: boolean;
  meta?: ReactNode;
  headIcon?: { icon: LucideIcon; tone: CardHeadTone };
  cols?: 1 | 2;
  /** Label of the main button in edit mode: "Save", "Send to SBC". */
  saveLabel?: string;
  /** Muted text at the right of the head when the card cannot be edited. */
  readOnlyNote?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(rows.map((r) => r.v));
  const start = () => {
    setDraft(rows.map((r) => r.v));
    setEditing(true);
  };
  const changes = rows
    .map((r, i) => ({ k: r.k, before: r.v, after: (draft[i] ?? r.v).trim() }))
    .filter((c, i) => !rows[i]?.locked && c.after !== c.before.trim());
  const save = async () => {
    if (changes.length === 0) return;
    await onSave?.(
      changes,
      rows.map((r, i) => ({ ...r, v: r.locked ? r.v : (draft[i] ?? r.v).trim() })),
    );
    setEditing(false);
  };

  const right =
    editable && !editing ? (
      <Button size="sm" variant="secondary" onClick={start}>
        <Pencil size={14} strokeWidth={1.6} aria-hidden /> Edit
      </Button>
    ) : !editable && readOnlyNote ? (
      <span className="text-[12.5px] text-ink-muted">{readOnlyNote}</span>
    ) : undefined;

  return (
    <DashSection title={title} meta={meta} headIcon={headIcon} right={right}>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-faint">None</p>
      ) : editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className={cn('grid gap-x-6 gap-y-3', cols === 2 && 'sm:grid-cols-2')}>
            {rows.map((r, i) => (
              <label key={r.k} className="grid min-w-0 gap-1">
                <span className="text-[12px] text-ink-muted">{r.k}</span>
                <Input
                  value={draft[i] ?? ''}
                  disabled={r.locked || saving}
                  onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? e.target.value : x)))}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className={cn('h-[34px]', r.mono && 'font-mono text-[13px]')}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- Edit moves focus to the first field.
                  autoFocus={i === 0}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line-soft pt-3">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={changes.length === 0 || saving}>
              {saveLabel}
            </Button>
          </div>
        </form>
      ) : (
        <dl className={cn('grid gap-x-6 gap-y-3', cols === 2 && 'sm:grid-cols-2')}>
          {rows.map((r) => (
            <div key={r.k} className="min-w-0">
              <dt className="text-[12px] text-ink-muted">{r.k}</dt>
              <dd className={cn('break-words text-[13.5px] font-medium text-ink', r.mono && 'font-mono text-[13px]', (r.v === '-' || r.v === '—' || !r.v) && 'text-ink-faint')}>
                {r.v || '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </DashSection>
  );
}

/** The text of a change request for edited facts: one "Label: before → after" line each. */
export function factChangeNote(title: string, changes: Array<{ k: string; before: string; after: string }>): string {
  const lines = changes.map((c) => `${c.k}: ${c.before.trim() || '—'} → ${c.after || '—'}`);
  return [`Please update ${title}:`, ...lines].join('\n');
}
