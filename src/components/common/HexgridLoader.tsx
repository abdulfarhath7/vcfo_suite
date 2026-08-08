"use client";

import { cn } from "@/lib/utils";

const HEX_R = 16;
const CENTER = 160;
const DX = HEX_R * Math.sqrt(3);
const DY = HEX_R * 1.5;

const HEX_LAYOUT = [
  { row: -2, col: -1.0, ring: 2 },
  { row: -2, col: 0.0, ring: 2 },
  { row: -2, col: 1.0, ring: 2 },
  { row: -1, col: -1.5, ring: 2 },
  { row: -1, col: -0.5, ring: 1 },
  { row: -1, col: 0.5, ring: 1 },
  { row: -1, col: 1.5, ring: 2 },
  { row: 0, col: -2.0, ring: 2 },
  { row: 0, col: -1.0, ring: 1 },
  { row: 0, col: 0.0, ring: 0 },
  { row: 0, col: 1.0, ring: 1 },
  { row: 0, col: 2.0, ring: 2 },
  { row: 1, col: -1.5, ring: 2 },
  { row: 1, col: -0.5, ring: 1 },
  { row: 1, col: 0.5, ring: 1 },
  { row: 1, col: 1.5, ring: 2 },
  { row: 2, col: -1.0, ring: 2 },
  { row: 2, col: 0.0, ring: 2 },
  { row: 2, col: 1.0, ring: 2 },
] as const;

const SIZE_PX = {
  sm: 56,
  md: 96,
  lg: 128,
} as const;

function hexPath(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Ring 0: primary gold · ring 1: gold-hi / warning · ring 2: gold-deep / muted */
function tierFor(ring: 0 | 1 | 2) {
  if (ring === 0) {
    return {
      fill: "hsl(var(--hex-loader-primary) / 0.38)",
      stroke: "hsl(var(--hex-loader-primary))",
      glow: "hsl(var(--hex-loader-gold-hi) / 0.55)",
    };
  }
  if (ring === 1) {
    return {
      fill: "hsl(var(--hex-loader-warning) / 0.2)",
      stroke: "hsl(var(--hex-loader-gold-hi))",
      glow: "hsl(var(--hex-loader-warning) / 0.35)",
    };
  }
  return {
    fill: "hsl(var(--hex-loader-gold-deep) / 0.1)",
    stroke: "hsl(var(--hex-loader-gold-deep))",
    glow: "hsl(var(--hex-loader-muted-paper) / 0.25)",
  };
}

export type HexgridLoaderProps = {
  size?: keyof typeof SIZE_PX;
  message?: string;
  /** When true, parent owns the live region (e.g. LoadingScreen). */
  silent?: boolean;
  className?: string;
};

export function HexgridLoader({
  size = "md",
  message,
  silent = false,
  className,
}: HexgridLoaderProps) {
  const dimension = SIZE_PX[size];
  const announced = !silent && (message ?? true);

  return (
    <div
      role={announced ? "status" : undefined}
      aria-live={announced ? "polite" : undefined}
      aria-label={announced ? (message ?? "Loading") : undefined}
      aria-hidden={silent ? true : undefined}
      className={cn(message ? "inline-flex flex-col items-center gap-3" : "inline-flex", className)}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox="0 0 320 320"
        className="shrink-0"
        aria-hidden
      >
        {HEX_LAYOUT.map((h, i) => {
          const x = CENTER + h.col * DX;
          const y = CENTER + h.row * DY;
          const t = tierFor(h.ring);
          return (
            <polygon
              key={i}
              className="hex-cell"
              points={hexPath(x, y, HEX_R - 1.5)}
              fill={t.fill}
              stroke={t.stroke}
              strokeWidth="1.1"
              style={{
                filter: `drop-shadow(0 0 3px ${t.glow})`,
                transformBox: "fill-box",
                transformOrigin: "center",
                animationDelay: `${(h.ring * 0.18).toFixed(2)}s`,
              }}
            />
          );
        })}
      </svg>
      {message ? (
        <p className="mono max-w-[240px] text-center text-[12px] leading-snug text-muted-paper">
          {message}
        </p>
      ) : null}
    </div>
  );
}
