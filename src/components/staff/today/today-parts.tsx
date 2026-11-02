'use client';

import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { initialsFromName } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { TODAY_STATUS_ORDER, type TodayScope, type TodayStatus } from '@/components/staff/today/today-rows';

/* Small shared parts for the staff Today screens. Companies are identities and stay neutral
   (docs/design/TOKENS.md): colour on these screens only carries status. */

/** The company tile: initials on a neutral 6px square (R-44). */
export function CompanyTile({ name, size = 26 }: { name: string; size?: 26 | 30 }) {
  return (
    <span
      className={cn(
        'grid flex-none place-items-center rounded-md bg-surface-sunken font-medium tracking-[.02em] text-ink-2',
        size === 30 ? 'h-[30px] w-[30px] text-[13px]' : 'h-[26px] w-[26px] text-[11px]',
      )}
      title={name}
      aria-hidden
    >
      {(initialsFromName(name) || '·').slice(0, 2).toUpperCase()}
    </span>
  );
}

/** A person's face (initials in a circle) and first name (or the full name), for lead cells. */
export function PersonCell({ name, size = 24, full }: { name: string; size?: 24 | 28; full?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2" title={name}>
      <span
        className="grid flex-none place-items-center rounded-full bg-surface-sunken text-[10.5px] font-medium text-ink-2"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {(initialsFromName(name) || '·').slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0 truncate">{full ? name : name.split(/\s+/)[0]}</span>
    </span>
  );
}

/** Greeting scope switch (N5 segmented): All, Incorporating, Compliance, each with its count. */
export function TodayScopeTabs({
  value,
  onChange,
  counts,
}: {
  value: TodayScope;
  onChange: (scope: TodayScope) => void;
  counts: { all: number; incorporating: number; compliance: number };
}) {
  return (
    <SpectrumTabs
      size="md"
      label="Clients shown"
      items={[
        { key: 'all', label: 'All', count: counts.all },
        { key: 'incorporating', label: 'Incorporating', count: counts.incorporating },
        { key: 'compliance', label: 'Compliance', count: counts.compliance },
      ]}
      value={value}
      onChange={(k) => onChange(k as TodayScope)}
      // M-30: tighter tabs on a phone, so the home card's actions fit on the same line.
      className="max-sm:[&>button]:px-2"
    />
  );
}

/** A legend of status squares under a chart or grid. */
export function StatusLegend({ statuses, className }: { statuses: TodayStatus[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-muted', className)}>
      {TODAY_STATUS_ORDER.filter((s) => statuses.includes(s.status)).map((s) => (
        <li key={s.status} className="flex items-center gap-1.5">
          <i className={cn('h-2 w-2 rounded-[2px]', s.bar)} aria-hidden />
          {s.status}
        </li>
      ))}
    </ul>
  );
}
