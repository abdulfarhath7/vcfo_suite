import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Card title with an icon tile in the card's identifying hue. */
export function CardHeading({
  icon: Icon,
  hue,
  title,
  className,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  /** oklch triplet var, e.g. `var(--primary)`. */
  hue: string;
  title: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5', className)} style={{ '--card': hue } as CSSProperties}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[oklch(var(--card)/0.12)] text-[oklch(var(--card))] ring-1 ring-[oklch(var(--card)/0.2)]">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <h2 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
      {children}
    </div>
  );
}
