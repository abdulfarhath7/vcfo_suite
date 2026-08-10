'use client';

import {
  BOARD_RESOLUTION_MERGE_FIELD_KEYS,
  BOARD_RESOLUTION_MERGE_FIELD_LABELS,
  type BoardResolutionMergeFields,
} from '@/lib/board-resolution';
import { cn } from '@/lib/utils';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export type BoardResolutionMergeFieldsPanelProps = {
  fields: BoardResolutionMergeFields;
  activeFieldKey: keyof BoardResolutionMergeFields | null;
  saveStatus: SaveStatus;
  onFieldSelect: (fieldKey: keyof BoardResolutionMergeFields) => void;
};

function truncateValue(value: string, max = 48): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed || '—';
  return `${trimmed.slice(0, max - 1)}…`;
}

function saveStatusLabel(status: SaveStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Unsaved changes…';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'All changes saved';
    case 'error':
      return 'Save failed';
    default:
      return null;
  }
}

export function BoardResolutionMergeFieldsPanel({
  fields,
  activeFieldKey,
  saveStatus,
  onFieldSelect,
}: BoardResolutionMergeFieldsPanelProps) {
  const statusText = saveStatusLabel(saveStatus);

  return (
    <aside
      className="flex flex-col rounded-lg border border-border/60 bg-panel/40"
      aria-label="Merge fields"
    >
      {statusText && (
        <p
          className="border-b border-border/50 px-4 py-2 text-[11px] text-text-tertiary"
          aria-live="polite"
          aria-atomic="true"
        >
          {statusText}
        </p>
      )}

      <ul className="max-h-[min(70vh,900px)] overflow-y-auto overscroll-contain p-2">
        {BOARD_RESOLUTION_MERGE_FIELD_KEYS.map((key) => {
          const isActive = activeFieldKey === key;
          const label = BOARD_RESOLUTION_MERGE_FIELD_LABELS[key];
          const value = fields[key];

          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onFieldSelect(key)}
                className={cn(
                  'w-full rounded-md px-3 py-2.5 text-left transition-colors duration-150 motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                  isActive
                    ? 'border border-orange/35 bg-orange/10'
                    : 'border border-transparent hover:bg-raised/60',
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                <span
                  className={cn(
                    'block text-[11px] uppercase tracking-wide font-medium',
                    isActive ? 'text-gold' : 'text-text-tertiary',
                  )}
                >
                  {label}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-ink leading-snug line-clamp-2">
                  {truncateValue(value)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
