'use client';

/**
 * Small pieces the Today panels share: the client mark, the progress ring,
 * the jump-to-panel flash, the clock, and the breakdown rows every count
 * opens (README: every count is a door).
 */
import type { CSSProperties } from 'react';
import type { DrillRow } from '../../overlays';
import { hueOf } from '../../ui';
import {
  F_COLOR,
  F_LABEL,
  Q_COLOR,
  T_COLOR,
  T_LABEL,
  dShort,
  type FView,
  type QItem,
  type TClient,
  type TItem,
  type TodayModel,
  type WItem,
} from './model';

/** Client initials tile (`.mx-av`) titled with the full company name. */
export function CAv({ c, big }: { c: Pick<TClient, 'id' | 'initials' | 'name'>; big?: boolean }) {
  return (
    <span className={'mx-av' + (big ? ' big' : '')} style={{ ['--cc' as string]: hueOf(c.id) } as CSSProperties} title={c.name} aria-hidden="true">
      {c.initials}
    </span>
  );
}

/** Client colour square (`.mx-dot`) with the company name as its tooltip. */
export function CDot({ c, size }: { c: Pick<TClient, 'id' | 'name'>; size?: number }) {
  return <span className="mx-dot" title={c.name} style={{ background: hueOf(c.id), ...(size ? { width: size, height: size } : null) }} />;
}

/** Progress ring (`.mx-ring2`, prototype mxRing). */
export function Ring({ pct, color, size = 46, title }: { pct: number; color: string; size?: number; title?: string }) {
  const S = size;
  const R = S / 2 - 4;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <svg viewBox={`0 0 ${S} ${S}`} width={S} height={S} className="mx-ring2" role="img" aria-label={title ?? `${p}%`}>
      {title ? <title>{title}</title> : null}
      <circle cx={S / 2} cy={S / 2} r={R} className="bg" />
      <circle cx={S / 2} cy={S / 2} r={R} className="fg" stroke={color} strokeDasharray={`${((p / 100) * C).toFixed(1)} ${C.toFixed(1)}`} transform={`rotate(-90 ${S / 2} ${S / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle">
        {p}%
      </text>
    </svg>
  );
}

/** Scroll a panel into view under the sticky top bar and flash it (prototype mxJump). */
export function jump(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: 'smooth' });
  el.classList.remove('mx-flash');
  void el.offsetWidth;
  el.classList.add('mx-flash');
}

const IST_MS = 5.5 * 3600e3;
/** "2:30 pm" in India. */
export function clockIst(now: number): string {
  const d = new Date(now + IST_MS);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'pm' : 'am'}`;
}
export function greetingIst(now: number): string {
  const h = new Date(now + IST_MS).getUTCHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/* ---------------------------------------------------------------- breakdown rows */

export function qRows(items: QItem[], m: TodayModel, go: (href: string) => void): DrillRow[] {
  return items.map((q) => ({
    id: q.id,
    title: `${q.title} · ${m.byId[q.clientId]?.short ?? ''}`,
    meta: q.why,
    state: q.status,
    color: Q_COLOR[q.state],
    onOpen: () => go(q.cta.href),
  }));
}

export function tRows(items: TItem[], m: TodayModel, open: (t: TItem) => void): DrillRow[] {
  return items.map((t) => ({
    id: t.id,
    title: `${t.title} · ${m.byId[t.clientId]?.short ?? ''}`,
    meta: `${t.leadName} · ${t.dueLabel}`,
    state: T_LABEL[t.st],
    color: T_COLOR[t.st],
    onOpen: () => open(t),
  }));
}

export function fRows(base: string, items: FView[], m: TodayModel, go: (href: string) => void): DrillRow[] {
  return items.map((f) => ({
    id: f.id,
    title: `${f.name} · ${m.byId[f.clientId]?.short ?? ''}`,
    meta: f.filedOn ? `Due ${dShort(f.due, m.today)} · filed ${dShort(f.filedOn, m.today)}` : `${f.st === 'o' ? 'Was due' : 'Due'} ${dShort(f.due, m.today)}`,
    state: F_LABEL[f.st],
    color: F_COLOR[f.st],
    onOpen: () => go(`${base}/compliances/filings`),
  }));
}

export function wRows(items: WItem[], m: TodayModel, openW: (w: WItem) => void, color: (w: WItem) => string): DrillRow[] {
  return items.map((w) => ({
    id: w.id,
    title: w.title,
    meta: dShort(w.day, m.today),
    state: w.lane === 'filing' ? 'Filing' : w.lane === 'step' ? 'Step deadline' : w.lane === 'task' ? 'Team task' : 'Done',
    color: color(w),
    onOpen: () => openW(w),
  }));
}
