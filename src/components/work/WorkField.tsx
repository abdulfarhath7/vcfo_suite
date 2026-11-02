'use client';

import { useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** A small label above one control in the work dialogs; the control receives the id. */
export function WorkField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn('grid gap-1', className)}>
      <Label htmlFor={id} className="text-[12.5px] font-normal text-ink-muted">
        {label}
      </Label>
      {children(id)}
    </div>
  );
}
