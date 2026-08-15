"use client";

import { ButtonHTMLAttributes } from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { pressScale } from "@/lib/motion";

type Variant = "solid" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface AccentButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const sizeMap: Record<Size, string> = {
  sm: "h-9 px-3 text-xs min-h-[44px] sm:min-h-9",
  md: "h-10 px-4 text-sm min-h-[44px] sm:min-h-10",
  lg: "h-11 px-5 text-sm min-h-[44px]",
};

const variantMap: Record<Variant, string> = {
  solid: "bg-primary text-primary-foreground font-medium hover:bg-primary-dark shadow-none",
  outline:
    "bg-panel text-primary border border-border hover:bg-primary-light hover:border-primary/35",
  ghost: "bg-transparent text-primary hover:bg-primary-light",
};

/** Role-aware primary button — solid blue, cool outline, blue ghost. */
export function AccentButton({
  ref,
  className,
  variant = "solid",
  size = "md",
  onDrag,
  onDragStart,
  onDragEnd,
  onAnimationStart,
  onAnimationEnd,
  ...props
}: AccentButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const reduceMotion = useReducedMotion();
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-[10px] transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    "disabled:opacity-40 disabled:pointer-events-none",
    "tracking-tight",
    variantMap[variant],
    sizeMap[size],
    className,
  );

  if (reduceMotion) {
    return <button type="button" ref={ref} className={classes} {...props} />;
  }

  return (
    <m.button
      type="button"
      ref={ref}
      className={classes}
      whileTap={pressScale.whileTap}
      transition={pressScale.transition}
      {...props}
    />
  );
}

/** @deprecated Use AccentButton — kept for gradual migration */
export const GoldButton = AccentButton;
