'use client';

import type { ReactNode } from 'react';
import { Tip } from '@/components/ui/tip';
import { cn } from '@/lib/utils';

/**
 * The small square icon button of a document row (preview, download). Its `label` is the
 * accessible name ("Preview MOA") and the tip. When `disabledReason` is set the button is off and
 * the tip says why. It uses `aria-disabled`, not `disabled`, so the button keeps focus and hover
 * and the reason stays reachable by keyboard and screen reader.
 */
export function DocumentIconButton({
  label,
  icon,
  onClick,
  disabledReason,
  busy = false,
  testId,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabledReason?: string | null;
  busy?: boolean;
  testId?: string;
}) {
  const disabled = Boolean(disabledReason) || busy;
  const button = (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onClick();
      }}
      aria-disabled={disabled || undefined}
      aria-label={disabledReason ? `${label}: ${disabledReason}` : label}
      aria-busy={busy || undefined}
      data-testid={testId}
      className={cn(
        'grid h-[30px] w-[30px] flex-none place-items-center rounded-md border-1.5 border-line text-ink-2',
        disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-surface-sunken hover:text-ink',
      )}
    >
      {icon}
    </button>
  );
  return <Tip label={disabledReason || label}>{button}</Tip>;
}
