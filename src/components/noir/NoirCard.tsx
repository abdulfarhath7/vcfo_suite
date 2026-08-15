"use client";

import { HTMLAttributes } from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from '@/lib/utils';
import { cardHover } from '@/lib/motion';

interface NoirCardProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  /** Border-only panel — no layered shadow. */
  flat?: boolean;
  interactive?: boolean;
}

export function NoirCard({
  ref,
  className,
  raised,
  flat,
  interactive,
  onDrag,
  onDragStart,
  onDragEnd,
  onAnimationStart,
  onAnimationEnd,
  ...props
}: NoirCardProps & { ref?: React.Ref<HTMLDivElement> }) {
  const reduceMotion = useReducedMotion();
  const classes = cn(
    flat ? (raised ? 'surface-flat-raised' : 'surface-flat') : raised ? 'surface-raised' : 'surface',
    'border-border',
    interactive && 'transition-all duration-200 hover:border-primary/35 cursor-pointer',
    className,
  );

  if (interactive && !reduceMotion) {
    return (
      <m.div
        ref={ref}
        className={classes}
        whileHover={cardHover.whileHover}
        transition={cardHover.transition}
        {...props}
      />
    );
  }

  return <div ref={ref} className={classes} {...props} />;
}
