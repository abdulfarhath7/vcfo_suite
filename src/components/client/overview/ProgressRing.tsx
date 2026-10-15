'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** A progress ring that sweeps from zero to its value when it mounts. */
export function ProgressRing({
  pct,
  size,
  stroke,
  color,
  track = 'oklch(var(--border))',
  label,
  children,
}: {
  pct: number;
  size: number;
  stroke: number;
  color: string;
  track?: string;
  label: string;
  children?: ReactNode;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(Math.min(100, Math.max(0, pct))));
    return () => cancelAnimationFrame(frame);
  }, [pct]);

  const radius = (size - stroke) / 2;
  const turn = 2 * Math.PI * radius;
  const done = (shown / 100) * turn;

  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          className="client-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${done} ${turn - done}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? <span className="relative">{children}</span> : null}
    </span>
  );
}
