'use client';

import { ProgressBar } from '@/components/common/ProgressBar';
import { cn } from '@/lib/utils';

interface ChecklistSectionHeaderProps {
  title: string;
  done: number;
  total: number;
  completeLabel: string;
  variant?: 'admin' | 'client';
}

export function ChecklistSectionHeader({
  title,
  done,
  total,
  completeLabel,
  variant = 'admin',
}: ChecklistSectionHeaderProps) {
  const isClient = variant === 'client';
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="mb-5 flex items-center gap-4">
      {isClient ? null : (
        <div className="hidden w-48 sm:block">
          <ProgressBar value={pct} className="[&>div]:bg-brand" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {!isClient && (
          <h2 className="serif text-lg font-semibold text-foreground">{title}</h2>
        )}
        <p
          className={cn(
            'text-xs tabular-nums',
            isClient ? 'text-text-tertiary' : 'mt-0.5 text-muted-foreground',
          )}
        >
          {done} of {total} {completeLabel}
        </p>
      </div>
      {!isClient && (
        <div className="w-32 sm:hidden">
          <ProgressBar value={pct} className="[&>div]:bg-brand" />
        </div>
      )}
    </div>
  );
}
