"use client";

import { HTMLAttributes } from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cardHover } from "@/lib/motion";

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  /** Border-only panel — no layered shadow (kanban columns, inline dividers). */
  flat?: boolean;
  interactive?: boolean;
}

/** Unified card/surface primitive — warm border, optional spring hover. */
export function Surface({
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
}: SurfaceProps & { ref?: React.Ref<HTMLDivElement> }) {
  const reduceMotion = useReducedMotion();
  const classes = cn(
    flat ? (raised ? "surface-flat-raised" : "surface-flat") : raised ? "surface-raised" : "surface",
    "border-orange-100/80",
    interactive && "surface-interactive transition-all duration-200 hover:border-orange-200 cursor-pointer",
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
