'use client';

import { m, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ActivityEvent } from '@/data/engagements';

interface Props {
  items: ActivityEvent[];
  interval?: number;
}

/** Rotating one-line live activity strip with gold pulse dot. */
export function ActivityTicker({ items, interval = 3600 }: Props) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), interval);
    return () => clearInterval(t);
  }, [items.length, interval]);
  const item = items[idx];
  if (!item) return null;
  return (
    <div className="flex items-center gap-3 overflow-hidden h-6">
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold" />
      </span>
      <AnimatePresence mode="wait">
        <m.div
          key={item.id}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="text-[12px] text-paper-muted truncate"
        >
          <span className="text-paper font-medium">{item.actor}</span>{' '}
          <span>{item.verb}</span>{' '}
          {item.target && <span className="text-brand">{item.target}</span>}
          <span className="ml-2 mono text-[10.5px] text-subtle-paper">· {item.at}</span>
        </m.div>
      </AnimatePresence>
    </div>
  );
}
