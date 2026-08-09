import { m } from 'framer-motion';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KpiNumber } from '@/components/noir/KpiNumber';

/** Legacy decorative names map to semantic design tokens. */
export type AccentTone =
  | 'success'
  | 'info'
  | 'warning'
  | 'primary'
  | 'brand'
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'violet';

type SemanticTone = 'success' | 'info' | 'warning' | 'primary' | 'brand';

const LEGACY_TONE_MAP: Record<AccentTone, SemanticTone> = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  primary: 'primary',
  brand: 'brand',
  emerald: 'success',
  sky: 'info',
  amber: 'warning',
  violet: 'primary',
};

const TONE_STYLES: Record<
  SemanticTone,
  {
    card: string;
    iconShell: string;
    icon: string;
    corner: string;
    deltaPositive: string;
    deltaNegative: string;
  }
> = {
  success: {
    card: 'bg-panel border-border border-l-success',
    iconShell: 'bg-success-light',
    icon: 'text-success-text',
    corner: 'bg-success/40',
    deltaPositive: 'bg-success-light text-success-text',
    deltaNegative: 'bg-danger-light text-danger-text',
  },
  info: {
    card: 'bg-panel border-border border-l-info',
    iconShell: 'bg-info-light',
    icon: 'text-info-text',
    corner: 'bg-info/40',
    deltaPositive: 'bg-success-light text-success-text',
    deltaNegative: 'bg-danger-light text-danger-text',
  },
  warning: {
    card: 'bg-panel border-border border-l-warning',
    iconShell: 'bg-warning-light',
    icon: 'text-warning-text',
    corner: 'bg-warning/40',
    deltaPositive: 'bg-success-light text-success-text',
    deltaNegative: 'bg-danger-light text-danger-text',
  },
  primary: {
    card: 'bg-panel border-border border-l-primary',
    iconShell: 'bg-primary-light',
    icon: 'text-primary-dark',
    corner: 'bg-primary/40',
    deltaPositive: 'bg-success-light text-success-text',
    deltaNegative: 'bg-danger-light text-danger-text',
  },
  brand: {
    card: 'bg-panel border-border border-l-brand',
    iconShell: 'bg-primary-light',
    icon: 'text-brand-deep',
    corner: 'bg-brand/40',
    deltaPositive: 'bg-success-light text-success-text',
    deltaNegative: 'bg-danger-light text-danger-text',
  },
};

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
  tone?: AccentTone;
  icon?: LucideIcon;
  /** When set, tile is a link and gets hover lift; otherwise static. */
  href?: string;
}

/**
 * Editorial KPI tile with per-metric semantic accent.
 * Numeric values render with KpiNumber count-up; strings render in serif at scale.
 */
export function AccentKpi({ label, value, hint, delta, tone = 'primary', icon: Icon, href }: Props) {
  const semantic = LEGACY_TONE_MAP[tone];
  const styles = TONE_STYLES[semantic];

  const numeric = typeof value === 'number' || (typeof value === 'string' && /^[\d.,]+%?$/.test(value));
  const numValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/[%,]/g, ''))
        : 0;
  const suffix = typeof value === 'string' && value.includes('%') ? '%' : undefined;

  const deltaTone =
    delta && delta.trim().startsWith('-') ? styles.deltaNegative : styles.deltaPositive;

  const body = (
    <>
      <div className={cn('absolute top-0 left-[3px] w-8 h-px', styles.corner)} />
      <div className={cn('absolute top-0 left-0 w-px h-8', styles.corner)} />

      <div className="flex items-start justify-between gap-2">
        <div className="eyebrow">{label}</div>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              styles.iconShell,
            )}
          >
            <Icon className={cn('h-4 w-4', styles.icon)} />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        {numeric ? (
          <KpiNumber
            value={Number.isFinite(numValue) ? numValue : 0}
            suffix={suffix}
            className="text-foreground"
          />
        ) : (
          <span
            className="serif text-foreground leading-none"
            style={{ fontSize: 'clamp(28px, 3.4vw, 40px)' }}
          >
            {value}
          </span>
        )}
        {delta && (
          <span className={cn('mono rounded-full px-1.5 py-0.5 text-[10.5px] font-medium', deltaTone)}>
            {delta}
          </span>
        )}
      </div>
      {hint && <div className="mt-2 text-[11.5px] text-text-tertiary">{hint}</div>}
    </>
  );

  const shellClass = cn(
    'noir-card shadow-layered relative overflow-hidden border border-l-[3px] p-5',
    styles.card,
    href && 'block transition-shadow hover:shadow-layered-lg',
  );

  if (href) {
    return (
      <m.div whileHover={{ y: -2 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
        <Link href={href} className={shellClass}>
          {body}
        </Link>
      </m.div>
    );
  }

  return <div className={shellClass}>{body}</div>;
}
