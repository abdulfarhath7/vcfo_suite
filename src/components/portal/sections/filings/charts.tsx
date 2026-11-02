'use client';

/**
 * The two small charts of the compliance sections (prototype a4_cal.js):
 *  - Donut:    status donut with a clickable legend (`donut()`), used by the
 *              Calendar rail and the Filings summary;
 *  - LawRings: one ring per area of law, filled by the share filed (`lawRings()`).
 * Hover highlights a segment / ring and its legend row; a click filters.
 */
import { useState } from 'react';
import { statusOf, type PortalFiling } from '@/lib/client-portal/compliances';
import { LAWS, lawVar, ST_COLOR, ST_LABEL, type FilingSt, type LawKey } from '../../ui';

export interface Seg<K extends string> {
  k: K;
  label: string;
  col: string;
  n: number;
}

const ST_ORDER: FilingSt[] = ['over', 'due', 'up', 'ok'];

/** Over / due / upcoming / filed counts of a list. */
export function statusSegs(rows: PortalFiling[], today: string): Seg<FilingSt>[] {
  const c: Record<FilingSt, number> = { over: 0, due: 0, up: 0, ok: 0 };
  for (const r of rows) c[statusOf(r, today)]++;
  return ST_ORDER.map((k) => ({ k, label: ST_LABEL[k], col: ST_COLOR[k], n: c[k] }));
}

export function Donut<K extends string>({
  segs,
  sel,
  onPick,
  centerTop = 'FILINGS',
}: {
  segs: Seg<K>[];
  sel: K | null;
  onPick: (k: K | null) => void;
  centerTop?: string;
}) {
  const [hl, setHl] = useState<K | null>(null);
  const total = segs.reduce((a, s) => a + s.n, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  const shown = segs.filter((s) => s.n);
  const gap = shown.length > 1 ? 2.5 : 0;
  let off = 0;
  const focus = segs.find((s) => s.k === (hl ?? sel));
  const opacity = (k: K) => (hl ? (k === hl ? 1 : 0.25) : sel && sel !== k ? 0.3 : 1);
  return (
    <div className="donut-row">
      <svg width="142" height="142" viewBox="0 0 142 142" role="img" aria-label={`${total} ${centerTop.toLowerCase()}`} onMouseLeave={() => setHl(null)}>
        <circle cx="71" cy="71" r={R} fill="none" style={{ stroke: 'var(--line-2)' }} strokeWidth="18" />
        {segs.map((s) => {
          if (!s.n) return null;
          const len = (s.n / total) * C;
          const el = (
            <circle
              key={s.k}
              className="dseg"
              cx="71"
              cy="71"
              r={R}
              fill="none"
              style={{ stroke: s.col, opacity: opacity(s.k), cursor: 'pointer', transition: 'opacity .2s' }}
              strokeWidth="18"
              strokeDasharray={`${Math.max(0, len - gap).toFixed(2)} ${C.toFixed(2)}`}
              strokeDashoffset={(-off).toFixed(2)}
              transform="rotate(-90 71 71)"
              onMouseEnter={() => setHl(s.k)}
              onClick={() => onPick(sel === s.k ? null : s.k)}
            >
              <title>
                {s.label}: {s.n}
              </title>
            </circle>
          );
          off += len;
          return el;
        })}
        <text x="71" y="74" textAnchor="middle" style={{ fill: 'var(--ink)', font: '700 28px var(--f-disp)' }}>
          {focus ? focus.n : total}
        </text>
        <text x="71" y="94" textAnchor="middle" style={{ fill: 'var(--ink-3)', font: '600 10px var(--f-disp)', letterSpacing: '.12em' }}>
          {(focus ? focus.label : centerTop).toUpperCase()}
        </text>
      </svg>
      <div className="dleg" onMouseLeave={() => setHl(null)}>
        {segs.map((s) => (
          <button
            key={s.k}
            type="button"
            aria-pressed={sel === s.k}
            className={hl === s.k ? 'hl' : undefined}
            onMouseEnter={() => setHl(s.k)}
            onClick={() => onPick(sel === s.k ? null : s.k)}
          >
            <i style={{ background: s.col }} />
            <span>{s.label}</span>
            <b>{s.n}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

const LAWSHORT: Record<LawKey, string> = { MCA: 'MCA', GST: 'GST', PAY: 'Payroll', IT: 'Income tax', FEMA: 'FEMA · RBI' };
export const lawShort = (k: LawKey): string => LAWSHORT[k];

/**
 * One ring per area of law: filled = share filed, a red dot when any is late.
 * `tasks` (F-3) adds a "Tasks" legend row for the non-statutory tasks of the
 * window: they have no law, so they get a row and no ring.
 */
export function LawRings({
  rows,
  today,
  sel,
  onPick,
  tasks,
}: {
  rows: PortalFiling[];
  today: string;
  sel: LawKey | 'all';
  onPick: (k: LawKey | 'all') => void;
  tasks?: { n: number; ok: number } | null;
}) {
  const [hl, setHl] = useState<LawKey | null>(null);
  const data = LAWS.map((l, i) => {
    const list = rows.filter((r) => r.area === l.k);
    return {
      k: l.k,
      name: l.name,
      n: list.length,
      ok: list.filter((r) => statusOf(r, today) === 'ok').length,
      over: list.filter((r) => statusOf(r, today) === 'over').length,
      R: 31 + i * 12.5,
    };
  });
  const tot = data.reduce((a, d) => a + d.n, 0);
  const okT = data.reduce((a, d) => a + d.ok, 0);
  const pick = (k: LawKey) => onPick(sel === k ? 'all' : k);
  const op = (k: LawKey) => (hl ? (k === hl ? 1 : 0.2) : sel !== 'all' && sel !== k ? 0.25 : 1);
  const d = data.find((x) => x.k === hl);
  return (
    <div className="lawrings">
      <div style={{ position: 'relative', flex: 'none' }}>
        <svg width="176" height="176" viewBox="0 0 176 176" role="img" aria-label={`${okT} of ${tot} filed`} onMouseLeave={() => setHl(null)}>
          {data.map((x) => {
            const C = 2 * Math.PI * x.R;
            const f = x.n ? x.ok / x.n : 0;
            const a = -Math.PI / 2 + 2 * Math.PI * Math.min(0.999, f + 0.04);
            return (
              <g key={x.k} className="lring" style={{ opacity: op(x.k), cursor: 'pointer', transition: 'opacity .2s' }} onMouseEnter={() => setHl(x.k)} onClick={() => pick(x.k)}>
                <circle cx="88" cy="88" r={x.R} fill="none" strokeWidth="9" style={{ stroke: `color-mix(in srgb, ${lawVar(x.k)} 18%, transparent)` }} />
                {x.n && x.ok ? (
                  <circle
                    cx="88"
                    cy="88"
                    r={x.R}
                    fill="none"
                    strokeWidth="9"
                    strokeLinecap="round"
                    style={{ stroke: lawVar(x.k) }}
                    strokeDasharray={`${Math.max(0.01, C * f).toFixed(2)} ${C.toFixed(2)}`}
                    transform="rotate(-90 88 88)"
                  />
                ) : null}
                {x.over ? <circle cx={(88 + Math.cos(a) * x.R).toFixed(1)} cy={(88 + Math.sin(a) * x.R).toFixed(1)} r="4.5" strokeWidth="2" style={{ fill: 'var(--over)', stroke: 'var(--solid)' }} /> : null}
                <circle cx="88" cy="88" r={x.R} fill="none" stroke="transparent" strokeWidth="12">
                  <title>
                    {x.name}: {x.ok} of {x.n} filed
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <div>
            <b className="num" style={{ fontSize: 22, display: 'block' }}>
              {d ? `${d.ok}/${d.n}` : tot ? `${Math.round((okT / tot) * 100)}%` : '—'}
            </b>
            <span style={{ font: '600 9px var(--f-disp)', letterSpacing: '.12em', color: 'var(--ink-3)' }}>{d ? LAWSHORT[d.k].toUpperCase() : 'FILED'}</span>
          </div>
        </div>
      </div>
      <div className="lr-leg" onMouseLeave={() => setHl(null)}>
        {data.map((x) => (
          <button key={x.k} type="button" aria-pressed={sel === x.k} className={hl === x.k ? 'hl' : undefined} onMouseEnter={() => setHl(x.k)} onClick={() => pick(x.k)}>
            <i style={{ background: lawVar(x.k) }} />
            <span>{LAWSHORT[x.k]}</span>
            {x.over ? (
              <span className="pill over" style={{ padding: '3px 7px', fontSize: 10.5 }}>
                {x.over} late
              </span>
            ) : (
              <span />
            )}
            <em>
              <b>{x.ok}</b> / {x.n}
            </em>
          </button>
        ))}
        {tasks && tasks.n ? (
          <div role="note" aria-label={`Tasks: ${tasks.ok} of ${tasks.n} done`} style={{ display: 'grid', gridTemplateColumns: 'subgrid', gridColumn: '1 / -1', padding: '6px 8px', alignItems: 'center', font: '500 13.5px var(--f-disp)' }}>
            <i className="tsq" style={{ color: 'var(--ink-2)' }} />
            <span>Tasks</span>
            <span />
            <em>
              <b>{tasks.ok}</b> / {tasks.n}
            </em>
          </div>
        ) : null}
      </div>
    </div>
  );
}
