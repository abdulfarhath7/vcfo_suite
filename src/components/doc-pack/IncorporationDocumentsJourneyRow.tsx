'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText } from 'lucide-react';

import type { Engagement } from '@/data/engagements';
import { Chip } from '@/components/ui/spectrum-chip';
import { StepLink, StepMark, type StepLinkState, type StepState } from '@/components/ui/step-track';
import { useDocPack } from '@/hooks/use-doc-pack';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { docPackPagePath, type DocPackShell } from '@/lib/doc-pack/paths';
import { isInternEngagementPathname } from '@/lib/projects/project-step-path';
import { cn } from '@/lib/utils';

/** The words on the row and the page that lists the generated documents (owner, 12 November 2026). */
export const INCORPORATION_DOCUMENTS_TITLE = 'Incorporation Documents';

/**
 * INCORPORATION DOCUMENTS in the steps card, between KYC Review & DSC and SPICe+ Confirmation.
 *
 * It looks like a step row but is not a checklist step: it never gates SPICe+ Confirmation and has
 * no answers to submit. It opens the Incorporation Documents page, where every generated document
 * is listed under the director it belongs to. The mark is done when every document is ready, live
 * once KYC Review & DSC is done, and upcoming before that.
 */
export function IncorporationDocumentsJourneyRow({
  engagement,
  kycDone,
  connectorAbove,
  connector = true,
}: {
  engagement: Pick<Engagement, 'id' | 'slug'>;
  /** KYC Review & DSC is done, so the documents can be generated. */
  kycDone: boolean;
  /** The line up to the KYC Review & DSC mark. */
  connectorAbove?: StepLinkState;
  /** Draw the line down to the SPICe+ Confirmation mark. */
  connector?: boolean;
}) {
  const pathname = usePathname();
  const staffBase = useStaffBasePath();
  const shell: DocPackShell = isInternEngagementPathname(pathname) ? 'intern' : staffBase;
  const href = docPackPagePath(engagement, shell);
  const pack = useDocPack(engagement.id);

  const ready = pack.data?.counts.ready ?? 0;
  const total = pack.data?.total ?? 0;
  const allReady = total > 0 && ready === total;
  const state: StepState = allReady ? 'done' : kycDone ? 'now' : 'next';
  const live = state === 'now';
  const sub = pack.data
    ? `${ready} of ${total} documents ready · DIR-2, DIR-8, INC-9 and more for each director`
    : 'DIR-2, DIR-8, INC-9 and more for each director';

  return (
    <div
      className={cn(
        'group relative -mx-2.5 flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors',
        live ? 'bg-surface-sunken' : 'hover:bg-surface-sunken/60',
      )}
      data-ask-focus="incorporation-documents"
    >
      <StepLink x={21} up={connectorAbove} down={connector && (state === 'done' ? 'done' : 'todo')} />
      <StepMark state={state} label={allReady ? 'All documents ready' : live ? 'Documents to check' : 'Upcoming'} className="relative z-[1]" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="flex-none font-mono text-[12px] text-ink-muted">Docs</span>
          <Link
            href={href}
            className={cn(
              'min-w-0 truncate text-left text-[14px] uppercase tracking-[.02em] outline-none after:absolute after:inset-0 after:rounded-md hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring',
              live ? 'font-semibold text-ink' : 'font-medium text-ink',
            )}
          >
            {INCORPORATION_DOCUMENTS_TITLE}
          </Link>
          <FileText className="relative z-[1] h-4 w-4 flex-none self-center text-brand-text" aria-hidden />
        </span>
        <span className="truncate text-[12.5px] text-ink-muted">{sub}</span>
      </span>
      <span className="flex flex-none items-center gap-3">
        {state === 'next' ? (
          <span className="hidden w-[104px] sm:block" aria-hidden />
        ) : (
          <Chip fixed raw tone={allReady ? 'ok' : 'prog'}>{allReady ? 'Done' : `${ready} / ${total} ready`}</Chip>
        )}
      </span>
    </div>
  );
}
