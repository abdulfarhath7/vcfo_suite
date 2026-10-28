import * as React from 'react';
import { cn } from '@/lib/utils';

/* VCFO Spectrum chips (prototype src/components/ui/Chip.tsx). One file holds the status chip
   (R-13), the owner chip (R-14), the area pill (R-43) and the plain tag, so every portal draws
   them the same way. Colours come from the shared tokens only. */

export type ChipTone = 'ok' | 'warn' | 'bad' | 'prog' | 'idle' | 'violet' | 'teal';

const TONES: Record<ChipTone, string> = {
  ok: 'bg-positive-soft text-positive',
  warn: 'bg-warning-soft text-warning',
  bad: 'bg-danger-soft text-danger',
  prog: 'bg-brand-soft text-brand-text',
  idle: 'bg-upcoming-soft text-upcoming',
  violet: 'bg-identity-soft text-identity',
  teal: 'bg-waiting-soft text-waiting',
};
const DOTS: Record<ChipTone, string> = {
  ok: 'bg-positive-mid',
  warn: 'bg-warning-mid',
  bad: 'bg-danger-mid',
  prog: 'bg-brand',
  idle: 'bg-upcoming-mid',
  violet: 'bg-identity',
  teal: 'bg-waiting-mid',
};

/** Map a status word to a tone. Six meanings: not started, in progress, waiting, due soon, overdue, done. */
export function toneFor(status: string): ChipTone {
  const s = status.toLowerCase();
  if (/(done|complete|filed|approved|granted|active|paid|closed|resolved|\bok\b|healthy|connected|live|verified|on track)/.test(s)) return 'ok';
  if (/(overdue|late|fail|error|rejected|blocked|stuck|critical|down|expired|sent back|at risk)/.test(s)) return 'bad';
  if (/(waiting|pending|with client|with sbc|with mca|hold|needs|asked|sent|awaiting)/.test(s)) return 'teal';
  if (/(due|soon|warn|degraded|expir)/.test(s)) return 'warn';
  if (/(progress|current|running|filing|review|started|working|processing|open|mca)/.test(s)) return 'prog';
  return 'idle';
}

/** R-13: six words only. Long status variants collapse to the six; other words (Filed, Approved) stay. */
const SIX: Array<[RegExp, string]> = [
  [/^(due this week|due today|due tomorrow|due soon|due)$/i, 'Due soon'],
  [/^(with client|waiting on client|waiting on the client|waiting|pending with client|awaiting client)$/i, 'Waiting'],
  [/^(in progress|in-progress)$/i, 'In progress'],
  [/^(overdue|late)$/i, 'Overdue'],
  [/^(done|complete|completed)$/i, 'Done'],
  [/^(not started|not-started)$/i, 'Not started'],
];
export function statusWord(s: string): string {
  const hit = SIX.find(([re]) => re.test(s.trim()));
  return hit ? hit[1] : s;
}

const CHIP = 'inline-flex h-chip flex-none items-center gap-[7px] whitespace-nowrap rounded-md px-[9px] text-[12px] font-medium';

/** R-13: status chip. 24px high, 6px corners, 104px wide, 7px square dot, 12px weight 500. */
export function Chip({
  tone,
  fixed,
  dot = true,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone; fixed?: boolean; dot?: boolean }) {
  const t = tone ?? (typeof children === 'string' ? toneFor(children) : 'idle');
  const word = typeof children === 'string' ? statusWord(children) : children;
  return (
    <span
      title={typeof children === 'string' && word !== children ? children : undefined}
      className={cn(CHIP, TONES[t], fixed ? 'w-[104px] overflow-hidden' : 'min-w-[104px]', className)}
      {...rest}
    >
      {dot ? <i className={cn('h-[7px] w-[7px] flex-none rounded-[2px]', DOTS[t])} aria-hidden /> : null}
      <span className="min-w-0 truncate">{word}</span>
    </span>
  );
}

export type Owner = 'client' | 'sbc' | 'mca' | 'manager';
const OWNER: Record<Owner, [string, string, string]> = {
  client: ['bg-owner-client-soft text-owner-client', 'bg-warning-mid', 'Client'],
  sbc: ['bg-owner-sbc-soft text-owner-sbc', 'bg-owner-sbc', 'SBC'],
  mca: ['bg-owner-mca-soft text-owner-mca', 'bg-identity', 'MCA'],
  manager: ['bg-owner-manager-soft text-owner-manager', 'bg-waiting-mid', 'Manager'],
};

/** R-14: owner chip, 104px. Client amber, SBC blue, MCA violet. */
export function OwnerChip({ owner, label, className }: { owner: Owner; label?: string; className?: string }) {
  const [cls, dot, word] = OWNER[owner];
  return (
    <span className={cn(CHIP, 'w-[104px] overflow-hidden', cls, className)}>
      <i className={cn('h-[7px] w-[7px] flex-none rounded-[2px]', dot)} aria-hidden />
      <span className="min-w-0 truncate">{label ?? word}</span>
    </span>
  );
}

export type Regulator = 'mca' | 'gst' | 'it' | 'payroll' | 'fema' | 'labour';
const SWATCH: Record<Regulator, string> = {
  mca: 'bg-reg-mca',
  gst: 'bg-reg-gst',
  it: 'bg-reg-it',
  payroll: 'bg-reg-payroll',
  fema: 'bg-reg-fema',
  labour: 'bg-reg-labour',
};

/** The regulator for an area word, or undefined. "ROC" is MCA; "TDS" is income tax; PF and ESI are payroll. */
export function regOf(area: string): Regulator | undefined {
  const s = area.trim().toLowerCase();
  if (/^(mca|roc|incorporation|companies act|company law)/.test(s)) return 'mca';
  if (/^gst/.test(s)) return 'gst';
  if (/^(income tax|it|tds|tcs|direct tax)/.test(s)) return 'it';
  if (/^(payroll|pf|esi|epf|pf and esi)/.test(s)) return 'payroll';
  if (/^(fema|rbi|stpi)/.test(s)) return 'fema';
  if (/^(labour|labor|pt|professional tax|shops)/.test(s)) return 'labour';
  return undefined;
}

/** R-43: area pill. 24px, 6px corners, 1.5px edge, white fill, 104px, 8px swatch. The text stays ink. */
export function AreaPill({ area, reg, className }: { area: string; reg?: Regulator; className?: string }) {
  const r = reg ?? regOf(area);
  return (
    <span
      className={cn(
        'inline-flex h-chip w-[104px] flex-none items-center gap-1 overflow-hidden whitespace-nowrap rounded-md border-1.5 border-line bg-surface-raised px-[7px] text-[12px] font-medium text-ink-2',
        className,
      )}
    >
      <i className={cn('h-2 w-2 flex-none rounded-[2px]', r ? SWATCH[r] : 'bg-upcoming-mid')} aria-hidden />
      <span className="min-w-0 truncate">{area}</span>
    </span>
  );
}

/** Soft tag without a dot, for categories. A regulator word becomes an area pill (R-43). */
export function Tag({ tone = 'idle', className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  if (typeof children === 'string' && regOf(children)) return <AreaPill area={children} className={className} />;
  return <span className={cn('inline-flex h-chip items-center whitespace-nowrap rounded-md px-2 text-[12px] font-medium', TONES[tone], className)}>{children}</span>;
}
