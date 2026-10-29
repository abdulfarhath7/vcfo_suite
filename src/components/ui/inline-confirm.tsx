'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * R-40: ask before a risky change, in place (prototype InlineConfirm). One sunken row: the
 * question, a blurple confirm button and Cancel. Escape cancels. Never `window.confirm`.
 */
export function InlineConfirm({
  question,
  confirm,
  onConfirm,
  onCancel,
  busy,
  className,
}: {
  /** "Rotate the key for Email?" */
  question: string;
  /** The main button: "Rotate". */
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    // Escape on the row cancels; the row is an alertdialog that holds the two buttons.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="alertdialog"
      aria-label={question}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
      className={cn('flex flex-wrap items-center gap-2.5 border-t border-line-soft bg-surface-sunken px-4 py-2.5 md:px-5', className)}
    >
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink">{question}</span>
      <span className="flex flex-none items-center gap-2">
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the confirm row takes focus so Enter and Escape work at once. */}
        <Button size="sm" onClick={onConfirm} disabled={busy} autoFocus>
          {confirm}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </span>
    </div>
  );
}

/**
 * The developer-console change row (prototype ChangeConfirm): the question, the Now and After
 * values in mono, then the same confirm and Cancel buttons.
 */
export function ChangeConfirm({
  question,
  now,
  after,
  confirm,
  onConfirm,
  onCancel,
  busy,
  className,
}: {
  question: string;
  now: string;
  after: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    // Escape on the row cancels; the row is an alertdialog that holds the two buttons.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="alertdialog"
      aria-label={question}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
      className={cn('grid gap-2 border-t border-line-soft bg-surface-sunken px-4 py-2.5 md:px-5', className)}
    >
      <span className="text-[13px] font-semibold text-ink">{question}</span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-muted">
        <span>
          Now <span className="font-mono text-ink-2">{now}</span>
        </span>
        <span>
          After <span className="font-mono text-ink">{after}</span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the confirm row takes focus so Enter and Escape work at once. */}
        <Button size="sm" onClick={onConfirm} disabled={busy} autoFocus>
          {confirm}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </span>
    </div>
  );
}
