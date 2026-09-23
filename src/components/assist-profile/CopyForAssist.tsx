'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ClipboardCopy } from 'lucide-react';

import { getItem } from '@/data/checklist';
import { AccentButton } from '@/components/noir';
import { useAssistProfile } from '@/hooks/use-assist-profile';
import type { AssistProfileMissing } from '@/lib/assist-profile/types';
import { missingInputLabel } from '@/lib/doc-pack/unblock';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

function stepTitle(stepId: string): string {
  return getItem(stepId)?.title ?? stepId;
}

export type CopyForAssistProps = {
  engagementId: string;
  hrefForMissing: (input: Pick<AssistProfileMissing, 'stepId' | 'tabId'>) => string;
  className?: string;
};

/**
 * "Copy for Assist" — puts the engagement's VCFO Assist profile on the
 * clipboard for pasting into the extension. The chip counts what a lead can
 * still fill in Suite; what Suite cannot supply at all is listed apart, with
 * its reason, so a half-filled MCA form is never a surprise. Staff only.
 */
export function CopyForAssist({ engagementId, hrefForMissing, className }: CopyForAssistProps) {
  const query = useAssistProfile(engagementId);
  const [open, setOpen] = useState(false);
  const result = query.data;
  const fillable = result?.missing.filter((m) => !m.reason) ?? [];
  const unsupplied = result?.missing.filter((m) => m.reason) ?? [];

  const copy = async () => {
    try {
      const fresh = (await query.refetch()).data ?? result;
      if (!fresh) throw new Error(query.error ? errorMessage(query.error) : 'The profile is not loaded yet.');
      await navigator.clipboard.writeText(JSON.stringify(fresh.profile, null, 2));
      const gaps = fresh.missing.filter((m) => !m.reason).length;
      toastSuccess(
        'Profile copied for Assist',
        gaps > 0 ? `${gaps} ${gaps === 1 ? 'field is' : 'fields are'} still blank in Suite.` : 'Paste it into VCFO Assist.',
      );
    } catch (err) {
      toastError('Could not copy the Assist profile', errorMessage(err));
    }
  };

  return (
    <div
      className={cn('mb-3 rounded-lg border border-border bg-panel px-3 py-2 text-[12.5px]', className)}
      role="region"
      aria-label="VCFO Assist profile"
    >
      <div className="flex flex-wrap items-center gap-2">
        <AccentButton type="button" variant="outline" size="sm" onClick={copy} disabled={query.isPending}>
          <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
          Copy for Assist
        </AccentButton>
        {query.isError ? (
          <span className="text-muted-foreground">{errorMessage(query.error, 'The profile could not be loaded.')}</span>
        ) : !result ? (
          <span className="text-muted-foreground" aria-busy>
            Checking the profile…
          </span>
        ) : (
          <>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium',
                fillable.length === 0 ? 'bg-success-light text-success-text' : 'bg-warning-light text-warning-text',
              )}
            >
              {fillable.length === 0 ? 'Nothing missing' : `${fillable.length} missing`}
            </span>
            {unsupplied.length > 0 ? (
              <span className="text-muted-foreground">
                {unsupplied.length} {unsupplied.length === 1 ? 'field' : 'fields'} Suite cannot supply
              </span>
            ) : null}
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Hide details' : 'Show details'}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
            </button>
          </>
        )}
      </div>

      {open && result ? (
        <div className="mt-2 space-y-2 border-t border-dashed border-border pt-2">
          {fillable.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Missing in Suite">
              {fillable.map((input) => (
                <li key={input.key}>
                  <Link
                    href={hrefForMissing(input)}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-warning bg-panel px-2 py-0.5 text-[12.5px] text-foreground hover:bg-warning-light"
                  >
                    {missingInputLabel(input)}
                    <span className="text-muted-foreground">in {stepTitle(input.stepId)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {unsupplied.length > 0 ? (
            <ul className="space-y-0.5 text-muted-foreground" aria-label="Suite cannot supply">
              {unsupplied.map((input) => (
                <li key={input.key}>
                  <Link href={hrefForMissing(input)} className="text-foreground hover:underline">
                    {missingInputLabel(input)}
                  </Link>{' '}
                  — {input.reason}
                </li>
              ))}
            </ul>
          ) : null}
          {result.notes.length > 0 ? (
            <ul className="space-y-0.5 text-muted-foreground" aria-label="Notes for the lead">
              {result.notes.map((n, i) => (
                <li key={`${n.key}-${i}`}>{n.note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
