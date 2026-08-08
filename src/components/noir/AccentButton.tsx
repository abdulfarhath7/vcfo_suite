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
  solid: "gold-sheen font-medium hover:brightness-105 active:brightness-95 text-white",
  outline:
    "bg-transparent text-orange-700 border border-orange-200 hover:bg-orange-50 hover:border-orange-300",
  ghost: "bg-transparent text-muted-foreground hover:bg-orange-50/80 hover:text-foreground",
};

/** Role-aware primary button — orange fill with spring press. */
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
    "inline-flex items-center justify-center gap-2 rounded-md transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40",
    "disabled:opacity-50 disabled:pointer-events-none",
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
