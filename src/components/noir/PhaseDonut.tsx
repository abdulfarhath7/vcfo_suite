import { m } from 'framer-motion';
import { useMemo } from 'react';

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string; // oklch(var(--...)) or token
}

interface Props {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

/**
 * Editorial Noir donut chart.
 * - SVG arcs with a graceful stagger sweep on mount.
 * - Gold tick rails inside; centered serif value.
 */
export function PhaseDonut({
  segments,
  size = 188,
  thickness = 14,
  centerLabel,
  centerValue,
}: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const c = 2 * Math.PI * radius;

  const arcs = useMemo(() => {
    let offset = 0;
    return segments.map((seg) => {
      const frac = seg.value / total;
      const len = frac * c;
      const arc = { seg, dash: `${len} ${c - len}`, offset: -offset };
      offset += len;
      return arc;
    });
  }, [segments, total, c]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(var(--blue-200))"
          strokeWidth={thickness}
        />
        {arcs.map((a, i) => (
          <m.circle
            key={a.seg.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={a.seg.color}
            strokeWidth={thickness}
            strokeLinecap="butt"
            strokeDasharray={a.dash}
            strokeDashoffset={a.offset}
            initial={{ opacity: 0, pathLength: 0 }}
            animate={{ opacity: 1, pathLength: 1 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerValue !== undefined && (
          <div className="serif text-brand-deep leading-none" style={{ fontSize: 32 }}>
            {centerValue}
          </div>
        )}
        {centerLabel && (
          <div className="mono uppercase text-[10px] tracking-[0.18em] text-paper-muted mt-1.5">
            {centerLabel}
          </div>
        )}
      </div>
    </div>
  );
}
