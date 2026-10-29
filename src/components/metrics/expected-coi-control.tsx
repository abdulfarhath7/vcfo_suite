'use client';

import { useState } from 'react';
import { Award, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NoirDatePicker } from '@/components/noir/NoirDatePicker';
import { plainDay } from '@/components/super/parts/super-text';
import { useSetExpectedCoi } from '@/components/metrics/use-metrics';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/**
 * The expected certificate of incorporation date (G-13), beside the incorporation window on
 * the project record. Same look as `ScheduleWindowControl`: a quiet trigger with the date (or
 * "Expected COI"), a date picker, Save and Clear. Callers render it only for roles that may
 * set windows (manager, admin, super admin); the route and the repository enforce the same.
 */
export function ExpectedCoiControl({
  engagementId,
  value,
  className,
}: {
  engagementId: string;
  /** YYYY-MM-DD, or null when not set. */
  value: string | null | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(value ?? '');
  const mutation = useSetExpectedCoi();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(on);

  const commit = async (next: string | null) => {
    try {
      await mutation.mutateAsync({ engagementId, on: next });
      toastSuccess(next ? 'Expected COI saved' : 'Expected COI cleared', next ? plainDay(next) : undefined, {
        id: `expected-coi:${engagementId}`,
      });
      setOpen(false);
    } catch (err) {
      toastError('Could not save the date', errorMessage(err, 'Try again.'));
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setOn(value ?? '');
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2 py-1 text-[11px] tabular-nums text-ink-muted transition-colors hover:border-brand/40 hover:text-ink',
            value && 'border-solid',
            className,
          )}
          aria-label="Expected certificate date"
        >
          <Award className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {value ? `COI ${plainDay(value)}` : 'Expected COI'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[17rem] p-3">
        <p className="mb-2 text-[12px] font-semibold text-ink">Expected certificate date</p>
        <NoirDatePicker id={`expected-coi-${engagementId}`} value={on} onChange={setOn} />
        <div className="mt-3 flex items-center justify-end gap-2">
          {value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={mutation.isPending}
              onClick={() => void commit(null)}
              className="mr-auto text-ink-muted"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={mutation.isPending || !valid} onClick={() => void commit(on)}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
