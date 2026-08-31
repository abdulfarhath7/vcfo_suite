import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
  /**
   * Replaces the default mono `NN%` centre. Lets a large hero ring show a
   * serif number without forking this primitive.
   */
  center?: ReactNode;
}

/**
 * Donut progress indicator.
 *
 * The wrapper is a `div role="progressbar"`, NOT a `<progress>` element: a
 * `<progress>` is a replaced element, so its children are fallback content for
 * browsers without support and are never laid out. Rendered inside one, this
 * SVG measured 0×0 in Chromium and the ring simply did not draw.
 */
export function ProgressRing({
  value,
  size = 48,
  stroke = 4,
  className,
  label,
  center,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${clamped}% complete`}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(var(--border))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(var(--blue-600))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {center ?? (
        <span className="absolute mono text-[10px] font-medium text-primary">{clamped}%</span>
      )}
    </div>
  );
}
