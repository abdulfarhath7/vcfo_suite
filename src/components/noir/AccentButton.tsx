"use client";

import { ButtonHTMLAttributes } from "react";
import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { pressScale } from "@/lib/shell/motion";

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
  solid: "bg-brand text-on-brand font-medium hover:bg-brand-strong shadow-none",
  outline:
    "bg-surface-raised text-brand border border-line hover:bg-brand-soft hover:border-brand/35",
  ghost: "bg-transparent text-brand hover:bg-brand-soft",
};

/** Role-aware primary button — solid blue, cool outline, blue ghost. */
export function AccentButton({
  ref,
  className,
  variant = "solid",
  size = "md",
  onDrag: _onDrag,
  onDragStart: _onDragStart,
  onDragEnd: _onDragEnd,
  onAnimationStart: _onAnimationStart,
  onAnimationEnd: _onAnimationEnd,
  ...props
}: AccentButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const reduceMotion = useReducedMotion();
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-md transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/50",
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

