'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A 30px square that copies a value (prototype CopyButton). A green tick shows for 1.5 s. */
export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const h = window.setTimeout(() => setDone(false), 1500);
    return () => window.clearTimeout(h);
  }, [done]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).catch(() => {});
        setDone(true);
      }}
      aria-label={done ? 'Copied' : `Copy ${label ?? value}`}
      className={cn(
        'grid h-[30px] w-[30px] flex-none place-items-center rounded-md text-ink-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25',
        done && 'text-positive hover:text-positive',
        className,
      )}
    >
      {done ? <Check size={15} strokeWidth={1.6} aria-hidden /> : <Copy size={15} strokeWidth={1.6} aria-hidden />}
    </button>
  );
}
