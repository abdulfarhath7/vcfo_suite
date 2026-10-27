'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileInput,
  Mail,
  Send,
  Undo2,
  Zap,
} from 'lucide-react';
import { internKindChipLabel, internToneBadge, internToneSolid, KIND_TONE } from '@/components/intern/intern-tones';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { InternWorkDenseLayout } from '@/components/intern/InternWorkDenseLayout';
import { LeadCompanyPill } from '@/components/intern/LeadCompanyChip';
import { CHIP_CLASS } from '@/components/common/IconChip';
import type { InternWorkItem } from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

const KIND_ICON = {
  rejected: Undo2,
  review: Mail,
  deliver: Send,
  overdue: AlertTriangle,
  'in-progress': Clock,
  'waiting-client': Clock,
  'waiting-manager': Clock,
  'waiting-request': FileInput,
  filing: Clock,
  done: CheckCircle2,
} as const;

function InternWorkKindChip({
  kind,
  label,
  className,
}: {
  kind: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        CHIP_CLASS,
        'max-w-full shrink-0 overflow-hidden text-ellipsis',
        internToneSolid(KIND_TONE[kind] ?? 'info'),
        className,
      )}
    >
      {label ?? internKindChipLabel(kind)}
    </span>
  );
}

export function InternWorkDenseRow({
  item,
  showCompany = false,
  leading,
}: {
  item: InternWorkItem;
  showCompany?: boolean;
  leading?: ReactNode;
}) {
  return (
    <InternWorkDenseLayout
      leading={leading}
      title={
        <Link href={item.href} className="text-ink hover:underline" title={item.title}>
          {item.title}
        </Link>
      }
      subtitle={
        showCompany || item.windowLabel ? (
          <>
            {showCompany ? item.companyName : null}
            {showCompany && item.windowLabel ? ' · ' : null}
            {item.windowLabel ? (
              <span className="text-[11px] tabular-nums text-ink-muted">
                {item.windowLabel}
              </span>
            ) : null}
          </>
        ) : undefined
      }
      status={<InternWorkKindChip kind={item.kind} />}
      age={
        item.ageLabel ? (
          <span
            className={cn(
              CHIP_CLASS,
              'max-w-full overflow-hidden text-ellipsis',
              internToneBadge(item.kind === 'waiting-manager' ? 'danger' : 'neutral'),
            )}
          >
            {item.ageLabel}
          </span>
        ) : undefined
      }
      action={<InternWorkCtaButton item={item} />}
    />
  );
}

export function InternWorkQueueRow({ item }: { item: InternWorkItem }) {
  const tone = KIND_TONE[item.kind] ?? 'info';
  const Icon = KIND_ICON[item.kind] ?? Zap;
  return (
    <div className="border-t border-line py-2.5 pl-9 text-[13px]">
      <InternWorkDenseRow
        item={item}
        leading={
          <span className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md', internToneBadge(tone))}>
            <Icon className="h-3 w-3" strokeWidth={2.4} />
          </span>
        }
      />
    </div>
  );
}

export function InternWorkBoardCard({ item, dim }: { item: InternWorkItem; dim?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border border-line bg-surface-raised p-2.5 shadow-card',
        dim && 'opacity-65',
      )}
    >
      <Link
        href={item.href}
        title={item.title}
        className={cn(
          'block line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink',
          dim && 'text-ink-faint line-through',
        )}
      >
        {item.title}
      </Link>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
        <LeadCompanyPill name={item.companyName} engagementId={item.engagementId} />
        <InternWorkKindChip kind={item.kind} className="ml-auto" />
      </div>
      <InternWorkCtaButton item={item} className="mt-2 w-full" />
    </div>
  );
}
