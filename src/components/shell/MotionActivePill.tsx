'use client';

import { m } from 'framer-motion';
import { springSnappy } from '@/lib/motion';

/** Shared-element highlight that slides between siblings (sidebar, rails, tabs). */
export function MotionActivePill({
  layoutId,
  className,
  reduced,
}: {
  layoutId: string;
  className?: string;
  reduced?: boolean | null;
}) {
  if (reduced) {
    return <span aria-hidden className={className} />;
  }

  return (
    <m.div
      layoutId={layoutId}
      aria-hidden
      className={className}
      transition={springSnappy}
    />
  );
}
