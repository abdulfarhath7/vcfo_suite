'use client';

import Link from 'next/link';
import { TONE_BADGE, toneForKey } from '@/components/common/IconChip';
import { initialsFromName } from '@/lib/auth';

export function LeadCompanyChip({
  name,
  engagementId,
  compact = false,
}: {
  name: string;
  engagementId: string;
  compact?: boolean;
}) {
  const initials = initialsFromName(name) || '•';
  const tone = toneForKey(engagementId);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9.5px] font-extrabold ${TONE_BADGE[tone]}`}
      >
        {initials.slice(0, 2)}
      </span>
      {compact ? null : <span className="min-w-0 truncate font-semibold">{name}</span>}
    </span>
  );
}

export function LeadCompanyPill({ name, engagementId }: { name: string; engagementId: string }) {
  const tone = toneForKey(engagementId);
  const short = name.split(/\s+/)[0] ?? name;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${TONE_BADGE[tone]}`}>
      {short}
    </span>
  );
}
