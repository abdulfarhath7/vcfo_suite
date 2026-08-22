'use client';

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
import { internKindChipLabel, internToneBadge, internToneText, KIND_TONE } from '@/components/intern/intern-tones';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { LeadCompanyPill } from '@/components/intern/LeadCompanyChip';
import type { InternWorkItem } from '@/lib/intern-work';
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

export function InternWorkKindChip({
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
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
        internToneBadge(KIND_TONE[kind] ?? 'info'),
        className,
      )}
    >
      {label ?? internKindChipLabel(kind)}
    </span>
  );
}

export function InternWorkWhy({ item, className }: { item: InternWorkItem; className?: string }) {
  const tone = KIND_TONE[item.kind] ?? 'info';
  const Icon = KIND_ICON[item.kind] ?? Zap;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-extrabold', internToneText(tone), className)}>
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {item.why}
    </span>
  );
}

export function InternWorkQueueRow({ item }: { item: InternWorkItem }) {
  const tone = KIND_TONE[item.kind] ?? 'info';
  const Icon = KIND_ICON[item.kind] ?? Zap;
  return (
    <div className="flex items-start gap-2.5 border-t border-border px-3.5 py-2.5 text-[13px] transition-colors hover:bg-raised/60">
      <Link href={item.href} className="flex min-w-0 flex-1 gap-2.5">
        <span className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-sm', internToneBadge(tone))}>
          <Icon className="h-3 w-3" strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{item.title}</span>
          <span className="mt-1 flex justify-end">
            <InternWorkKindChip kind={item.kind} />
          </span>
        </span>
      </Link>
      <InternWorkCtaButton item={item} className="self-end" />
    </div>
  );
}

export function InternWorkBoardCard({ item, dim }: { item: InternWorkItem; dim?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-panel p-2.5 shadow-layered',
        dim && 'opacity-65',
      )}
    >
      <Link href={item.href} className={cn('block truncate text-[12.5px] font-bold leading-snug text-ink', dim && 'text-text-tertiary line-through')}>
        {item.title}
      </Link>
      <div className="mt-1.5 flex items-center gap-2">
        <LeadCompanyPill name={item.companyName} engagementId={item.engagementId} />
        <InternWorkKindChip kind={item.kind} className="ml-auto" />
      </div>
      <InternWorkCtaButton item={item} className="mt-2 w-full" />
    </div>
  );
}
