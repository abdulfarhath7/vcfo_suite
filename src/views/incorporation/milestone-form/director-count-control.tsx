'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PRE1_DIRECTOR_MIN = 2;
export const PRE1_DIRECTOR_MAX = 4;

/** Every Part A answer kept for one director slot. */
export function pre1DirectorSlotFieldIds(n: number): string[] {
  return ['FirstName', 'MiddleName', 'LastName', 'Gender', 'IndiaResident'].map((part) => `director${n}${part}`);
}

/**
 * The next Part A answers when the director count changes: the count itself, and the
 * answers of every slot that is no longer shown cleared, so a removed director never
 * reaches the board resolution.
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
 * Part A proposed directors (owner, 10 Nov): two directors show by default, "Add director"
 * adds one more up to four, and the last added one can be removed. Stored as the same
 * `directorCount` and `director{n}*` answers as before, so the board resolution and
 * Proposed Directors read them unchanged.
 */
export function DirectorCountControl({
  count,
  onChange,
  disabled,
}: {
  count: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-ink">
        {count} director{count === 1 ? '' : 's'}
      </span>
      {count < PRE1_DIRECTOR_MAX ? (
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange(count + 1)}>
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          Add director
        </Button>
      ) : (
        <span className="text-[12px] text-ink-muted">Up to four directors here; your lead adds more later.</span>
      )}
      {count > PRE1_DIRECTOR_MIN ? (
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(count - 1)}>
          <X className="mr-1 h-3.5 w-3.5" aria-hidden />
          Remove director {count}
        </Button>
      ) : null}
    </div>
  );
}
