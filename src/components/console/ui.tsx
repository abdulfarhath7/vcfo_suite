'use client';

/**
 * Console building blocks — the React form of the prototype's shared pieces
 * (a59n_mgr_shell.js "small shared pieces"): mxPanel, mxTag, mxEmpty, mxDot,
 * mxAv, mxLAv, mxDonut, mxLegend, mxField, mxSelect, plus a trend line that
 * only ever draws a REAL series (the prototype's were decorative samples).
 *
 * Generic atoms (Icon, Btn, IconBtn, GoArrow, Seg, Pill, StatusPill,
 * LawChip, DateTile, Timer) come from the client portal's ui.tsx and are
 * re-exported here so console pages import from one place.
 */
import type { ReactNode } from 'react';
import { Icon } from '@/components/portal/ui';

export {
  Icon,
  Sym,
  Btn,
  IconBtn,
  GoArrow,
  Seg,
  Pill,
  StatusPill,
  LawChip,
  LAWS,
  LAW_BY,
  lawVar,
  DateTile,
  Timer,
  initials,
  ST_LABEL,
  ST_COLOR,
  ST_RANK,
  type IconName,
  type SegOption,
  type LawKey,
  type FilingSt,
} from '@/components/portal/ui';

/* ---------------------------------------------------------------- panel */

/** `.glass.panel.mx-p`: title (+ sub line), optional stage tag, right-hand actions, body. */
export function Panel({
  title,
  sub,
  lead,
  need,
  act,
  cls,
  id,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  lead?: ReactNode;
  /** stage tag: the panel only applies to incorporating / compliance clients */
  need?: 'inc' | 'cmp';
  act?: ReactNode;
  cls?: string;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <section className={'glass panel mx-p' + (cls ? ' ' + cls : '')} id={id}>
      <div className="ph">
        {lead ?? null}
        <div className="mx-pt">
          <h3>{title}</h3>
          {sub ? <span className="small">{sub}</span> : null}
        </div>
        {need ? <StageTag need={need} /> : null}
        <span className="sp" />
        {act ?? null}
      </div>
      {children}
    </section>
  );
}

/** INCORPORATION / COMPLIANCE tag on panels that only apply to one stage. */
export function StageTag({ need }: { need: 'inc' | 'cmp' }) {
  return <span className={'mx-tag t-' + need}>{need === 'inc' ? 'Incorporation' : 'Compliance'}</span>;
}

/** Calm empty state with a tick (`.mx-empty`). */
export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mx-empty">
      <Icon name="check" />
      <b>{title}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- client / lead marks */

/**
 * A stable hue per client or person, from its id (the prototype gave each
 * sample client its own colour). Same id → same colour on every page.
 */
const HUES = ['#2dd4bf', '#818cf8', '#38bdf8', '#4ade80', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#e879f9', '#a3e635', '#f87171'];
export function hueOf(id: string): string {
  let x = 0;
  for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) >>> 0;
  return HUES[x % HUES.length]!;
}

/** Client colour dot (`.mx-dot`). */
export function Dot({ id, color, size, title }: { id?: string; color?: string; size?: number; title?: string }) {
  return <span className="mx-dot" title={title} style={{ background: color ?? hueOf(id ?? ''), ...(size ? { width: size, height: size } : null) }} />;
}

/** Client initials tile (`.mx-av`). */
export function ClientAv({ id, label, big }: { id: string; label: string; big?: boolean }) {
  return (
    <span className={'mx-av' + (big ? ' big' : '')} style={{ ['--cc' as string]: hueOf(id) }} title={label}>
      {label}
    </span>
  );
}

/** Lead initials (`.mx-lav`). */
export function LeadAv({ id, name, initials: ini, sm }: { id: string; name: string; initials: string; sm?: boolean }) {
  return (
    <span className={'mx-lav' + (sm ? ' sm' : '')} style={{ ['--lc' as string]: hueOf(id) }} title={name}>
      {ini}
    </span>
  );
}

/* ---------------------------------------------------------------- donut + legend (every count is a door) */

export interface DonutPart {
  n: number;
  color: string;
  label: string;
}

/** `.mx-donut`: hover a segment for its label and count; a click opens the breakdown (onPick(i) / onPick(-1) for the centre). */
export function Donut({ parts, size = 120, onPick, center }: { parts: DonutPart[]; size?: number; onPick?: (i: number, el: Element) => void; center?: [ReactNode, ReactNode] }) {
  const S = size;
  const R = S / 2 - 8;
  const C = 2 * Math.PI * R;
  const tot = parts.reduce((a, p) => a + p.n, 0);
  let acc = 0;
  return (
    <div
      className={'mx-dnw' + (onPick ? ' click' : '')}
      style={{ width: S, height: S }}
      title={onPick ? 'Open the breakdown' : undefined}
      role={onPick ? 'button' : undefined}
      tabIndex={onPick ? 0 : undefined}
      onClick={onPick ? (e) => onPick(-1, e.currentTarget) : undefined}
      onKeyDown={
        onPick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPick(-1, e.currentTarget);
              }
            }
          : undefined
      }
    >
      <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} className="mx-donut" aria-hidden="true">
        <circle cx={S / 2} cy={S / 2} r={R} className="mx-dn-bg" />
        {tot
          ? parts.map((p, i) => {
              if (!p.n) return null;
              const len = (p.n / tot) * C;
              const off = acc;
              acc += len;
              return (
                <circle
                  key={p.label}
                  cx={S / 2}
                  cy={S / 2}
                  r={R}
                  stroke={p.color}
                  className="mx-dn-seg"
                  strokeDasharray={`${Math.max(len - 2, 0.5)} ${C}`}
                  strokeDashoffset={-off}
                  transform={`rotate(-90 ${S / 2} ${S / 2})`}
                  onClick={
                    onPick
                      ? (e) => {
                          e.stopPropagation();
                          onPick(i, e.currentTarget);
                        }
                      : undefined
                  }
                >
                  <title>{`${p.label} · ${p.n}`}</title>
                </circle>
              );
            })
          : null}
      </svg>
      <div className="mx-dn-c">
        <b>{center ? center[0] : tot}</b>
        <span>{center ? center[1] : 'total'}</span>
      </div>
    </div>
  );
}

/** `.mx-leg`: one row per part (swatch, label, count); a click filters or drills. */
export function Legend({ parts, onPick, active }: { parts: DonutPart[]; onPick?: (i: number) => void; active?: number }) {
  return (
    <div className="mx-leg">
      {parts.map((p, i) => (
        <button key={p.label} type="button" className={'mx-lg' + (active === i ? ' on' : '')} onClick={onPick ? () => onPick(i) : undefined} disabled={!onPick} aria-pressed={onPick ? active === i : undefined}>
          <i style={{ background: p.color }} />
          <span>{p.label}</span>
          <b>{p.n}</b>
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- forms */

/** `.mx-f`: label, control, optional hint. */
export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="mx-f">
      <span className="mx-fl">{label}</span>
      {children}
      {hint ? <span className="mx-fh">{hint}</span> : null}
    </label>
  );
}

/** `select.lsel`: a compact filter select. */
export function Select<T extends string>({ value, options, onChange, label, cls }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string; cls?: string }) {
  return (
    <select className={'lsel' + (cls ? ' ' + cls : '')} aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/* ---------------------------------------------------------------- trend line (real series only) */

/**
 * A 14-point trend line for a KPI tile (`.gx-spw`). Pass the REAL daily
 * series (oldest first). With fewer than 2 points nothing is drawn — the
 * prototype's lines were invented and we never show invented history.
 */
export function Spark({ series, label }: { series: number[]; label?: string }) {
  if (series.length < 2) return null;
  const W = 120;
  const H = 28;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = max - min || 1;
  const xy = series.map((v, i) => [(i / (series.length - 1)) * W, H - 3 - ((v - min) / span) * (H - 6)] as const);
  const d = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = xy[xy.length - 1]!;
  return (
    <span className="gx-spw" aria-label={label ?? `Trend over the last ${series.length} days`} role="img">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="gx-sp" aria-hidden="true">
        <path d={`${d} L ${W} ${H} L 0 ${H} Z`} className="gx-spa" />
        <path d={d} className="gx-spl" />
      </svg>
      <i className="gx-spd" style={{ top: `${((last[1] / H) * 100).toFixed(1)}%` }} />
    </span>
  );
}
