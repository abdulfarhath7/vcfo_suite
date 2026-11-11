'use client';

import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ChecklistField } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist/checklist-responses';
import {
  applyShowWhen,
  expandRepeatEntry,
  repeatEntries,
  repeatFieldId,
  resolveFieldLabels,
  type RepeatField,
} from '@/lib/checklist/checklist-repeat';
import { Button } from '@/components/ui/button';
import { DinStatusBadge } from '@/components/incorporation/DinStatusBadge';
import { DIN_GROUP_ID } from '@/lib/checklist/din-verification';
import { DirectorGrid, DirectorViewToggle, useDirectorView } from '@/components/incorporation/DirectorGrid';

/** The DIN check is the badge in the name column, not a grid column. */
const DIN_GRID_HIDDEN: ReadonlySet<string> = new Set(['dinStatus', 'dinMismatchNote']);

/** Lower-case a noun for mid-sentence use, but keep an acronym ("NIC code" stays). */
function inSentence(noun: string): string {
  const firstWord = noun.split(' ')[0] ?? noun;
  return firstWord.length > 1 && firstWord === firstWord.toUpperCase() ? noun : noun.toLowerCase();
}

/**
 * Add / remove list for a `repeat` field. Each entry is a card of the
 * template fields rendered by the host form (`renderField`), so every input
 * type, autosave and error display stay exactly as they are for flat fields.
 * The host owns the responses; this only says which concrete ids to draw.
 */
export function RepeatGroupEditor({
  group,
  responses,
  renderField,
  onAdd,
  onRemove,
  grid,
}: {
  group: RepeatField;
  responses: ChecklistItemResponses;
  renderField: (field: ChecklistField) => ReactNode;
  onAdd: () => void;
  onRemove: (entryId: string) => void;
  /** SB-02: with these, the Proposed directors list offers the Cards / Grid switch. */
  grid?: {
    onCellChange: (cellKey: string, value: string) => void;
    isCellReadOnly: (cellKey: string) => boolean;
    errors?: Record<string, string | undefined>;
  };
}) {
  const entries = repeatEntries(responses, group);
  const [view, setView] = useDirectorView();
  const gridOn = Boolean(grid) && group.id === DIN_GROUP_ID;
  const noun = group.entryLabel ?? 'Entry';
  const max = group.maxEntries ?? Number.POSITIVE_INFINITY;
  const min = group.minEntries ?? 0;

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <p className="rounded-md border-fine px-3 py-3 text-sm text-ink-muted">
          {group.emptyLabel ?? `No ${inSentence(noun)} added yet.`}
        </p>
      ) : null}
      {gridOn ? <DirectorViewToggle view={view} onChange={setView} /> : null}
      {gridOn && grid && view === 'grid' && entries.length > 0 ? (
        <DirectorGrid
          columns={group.entryFields
            .filter((field) => !DIN_GRID_HIDDEN.has(field.id))
            .map((field) => ({ id: field.id, label: field.label, field }))}
          rows={entries.map((entry) => {
            const shown = new Set(applyShowWhen(expandRepeatEntry(group, entry.id), responses).map((f) => f.id));
            const name = [entry.values.firstName, entry.values.lastName].map((v) => (v ?? '').trim()).filter(Boolean).join(' ');
            return {
              key: entry.id,
              title: name ? `${noun} ${entry.index} · ${name}` : `${noun} ${entry.index}`,
              badge: <DinStatusBadge responses={responses} entryId={entry.id} compact />,
              cellKey: (col: string) => repeatFieldId(group.id, entry.id, col),
              shown: (col: string) => shown.has(repeatFieldId(group.id, entry.id, col)),
            };
          })}
          values={responses}
          readOnly={grid.isCellReadOnly}
          errors={grid.errors}
          onChange={grid.onCellChange}
        />
      ) : null}
      {!(gridOn && view === 'grid') && entries.map((entry) => (
        <section
          key={entry.id}
          aria-label={`${noun} ${entry.index}`}
          className="rounded-md border border-line/80 bg-surface-sunken/20 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <p className="text-[12px] font-semibold tracking-[.07em] uppercase text-ink-muted">
                {noun} {entry.index}
              </p>
              {group.id === DIN_GROUP_ID ? <DinStatusBadge responses={responses} entryId={entry.id} /> : null}
            </div>
            {entries.length > min ? (
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remove
              </button>
            ) : null}
          </div>
          <div className="milestone-form-grid">
            {resolveFieldLabels(applyShowWhen(expandRepeatEntry(group, entry.id), responses), responses).map((field) =>
              renderField(field),
            )}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {entries.length < max ? (
          <Button type="button" size="sm" variant="outline" onClick={onAdd} className="cursor-pointer">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add {inSentence(noun)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
