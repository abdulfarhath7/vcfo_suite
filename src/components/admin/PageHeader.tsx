import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Eyebrow } from '@/components/noir';
import { IconChip, type IconChipTone } from '@/components/common/IconChip';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  /** Accent hue for the rail (and icon chip when `icon` is set). */
  accent?: IconChipTone | 'emerald' | 'sky' | 'amber' | 'violet';
  /** Optional section icon rendered as a tinted chip beside the title. */
  icon?: LucideIcon;
  actions?: ReactNode;
  /** Show the back control even on a sidebar-home route (query-param drill-down). */
  forceBack?: boolean;
  backFallbackHref?: string;
}

const RAIL: Record<string, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  role: 'bg-role',
  neutral: 'bg-muted-foreground',
  emerald: 'bg-accent-emerald',
  sky: 'bg-accent-sky',
  amber: 'bg-accent-amber',
  violet: 'bg-accent-violet',
  rose: 'bg-accent-rose',
  orange: 'bg-accent-orange',
  teal: 'bg-accent-teal',
  pink: 'bg-accent-pink',
  cyan: 'bg-accent-cyan',
  lime: 'bg-accent-lime',
};

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  accent = 'role',
  icon,
  actions,
  forceBack,
  backFallbackHref,
}: Props) {
  const rail = RAIL[accent] ?? RAIL.role;
  return (
    <header className="mb-5 flex flex-col gap-3.5 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="flex min-w-0 gap-3 sm:gap-3.5">
        <div
          className={cn('w-[3px] shrink-0 self-stretch rounded-full sm:min-h-[2.75rem]', rail)}
          aria-hidden
        />
        {icon ? (
          <IconChip icon={icon} tone={(accent in RAIL ? accent : 'role') as IconChipTone} size="lg" className="self-center" />
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
          <div className="flex min-w-0 items-center gap-1.5">
            <PageBackButton className="-ml-1.5" force={forceBack} fallbackHref={backFallbackHref} />
            <h1 className="min-w-0 font-serif text-[clamp(1.35rem,2.2vw,1.75rem)] font-semibold leading-[1.15] tracking-tight text-foreground">
              {title}
            </h1>
          </div>
          {subtitle ? (
            <div className="prose-narrow mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 [&_a]:min-h-10 [&_button]:min-h-10">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
