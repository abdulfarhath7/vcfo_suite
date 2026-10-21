import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BotSays, InfoPopover } from '@/components/client-portal/shared';
import type { PortalStep } from '@/lib/client-portal/step-model';
import { dayMon } from './derive';

/* Small presentational pieces of the phone Home: icons, status marks, the pill
   tabs, bot line, card shell, count-up, the bottom-sheet drill and the stagger slot. */

const PATHS: Record<string, string> = {
  check: '<path d="M6 12.5l4 4 8-9"/>',
  clock: '<path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="9" r="3.4" fill="currentColor" stroke="none"/><path d="M5.5 19c1.2-3.2 3.6-4.6 6.5-4.6s5.3 1.4 6.5 4.6" fill="currentColor" stroke="none"/>',
  arrow: '<path d="M6 15l5-5 3 3 5-5 M14 8h5v5"/>',
  bang: '<path d="M12 6.5v7 M12 17.5h.01"/>',
  dl: '<path d="M12 4v11 M7.5 10.5 12 15l4.5-4.5 M5 19.5h14"/>',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"/>',
  ext: '<path d="M14 4.5h5.5V10 M19.5 4.5 11 13 M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10"/>',
  clip: '<path d="M15.5 7.5 8.6 14.4a2 2 0 0 0 2.8 2.8l7.3-7.3a3.8 3.8 0 0 0-5.4-5.4L6 11.8a5.6 5.6 0 0 0 8 8l5.5-5.5"/>',
  go: '<path d="M9 6l6 6-6 6"/>',
  up: '<path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14"/>',
  copy: '<path d="M9 9h10v11H9Z M5 15V4h10"/>',
};
export function I({ n, s = 16, w = 2 }: { n: keyof typeof PATHS; s?: number; w?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[n]! }} />;
}
export type K = 'done' | 'now' | 'you' | 'sbc' | 'up' | 'late';
const ST: Record<K, [keyof typeof PATHS | '', string]> = { done: ['check', 'Done'], now: ['clock', 'In progress'], you: ['user', 'Waiting on you'], sbc: ['arrow', 'With SBC'], up: ['', 'Upcoming'], late: ['bang', 'Late'] };
export function Si({ k, tip }: { k: K; tip?: string }) {
  const [ic, label] = ST[k];
  return (
    <span className={`si ${k}`} role="img" aria-label={tip ?? label} title={tip ?? label}>
      {ic ? <I n={ic} s={13} w={2.6} /> : null}
    </span>
  );
}
export function stepK(s: PortalStep): K {
  if (s.late && s.kind !== 'done') return 'late';
  return s.kind === 'done' ? 'done' : s.kind === 'you' || s.kind === 'prog' ? 'you' : s.kind === 'with' ? 'sbc' : 'up';
}
export function Tile({ iso, kind }: { iso: string; kind: 'over' | 'due' | 'up' | 'navy' }) {
  const [d, m] = dayMon(iso);
  const c = { over: { background: 'var(--over)', color: '#fff' }, due: { background: 'var(--due)', color: '#fff' }, up: { background: 'var(--raised)', color: 'var(--fg)' }, navy: { background: 'var(--navy)', color: '#fff' } }[kind];
  return (
    <span className="tile" style={c}>
      {d}
      <small>{m}</small>
    </span>
  );
}

/* ------------------------------------------------------------- pill */
export function MSeg({ id, tabs, sel, onSel }: { id: string; tabs: [string, number | string][]; sel: number; onSel: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [th, setTh] = useState<{ w: number; x: number } | null>(null);
  useEffect(() => {
    const place = () => {
      const b = ref.current?.querySelectorAll('button')[sel] as HTMLButtonElement | undefined;
      if (b) setTh({ w: b.offsetWidth, x: b.offsetLeft - 2 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [sel, tabs.length]);
  return (
    <div className="seg" role="tablist" data-seg={id} ref={ref}>
      <span className="th" style={th ? { width: th.w, transform: `translateX(${th.x}px)` } : undefined} />
      {tabs.map((t, i) => (
        <button key={t[0]} type="button" role="tab" aria-selected={i === sel} onClick={() => onSel(i)}>
          {t[0]}
          <span className="c">{t[1]}</span>
        </button>
      ))}
    </div>
  );
}

export function Bot({ text, act, q }: { text: string; act?: string; q?: string }) {
  return (
    <div style={{ padding: '10px 14px 14px' }}>
      <BotSays size={44} action={act ?? 'Ask VCFO why'} question={q ?? text}>
        <b style={{ display: 'block', font: '600 13px/1.45 Manrope' }}>{text}</b>
      </BotSays>
    </div>
  );
}

export function Card({ id, title, info, children, foot, right }: { id: string; title: string; info: string; children: ReactNode; foot?: [string, () => void]; right?: ReactNode }) {
  return (
    <section className="card t" id={`m-${id}`}>
      <div className="ch">
        <h2>{title}</h2>
        <InfoPopover askAbout={title} label="About this card">
          {info}
        </InfoPopover>
        {right}
      </div>
      {children}
      {foot ? (
        <button className="go" type="button" onClick={foot[1]}>
          {foot[0]} <I n="go" s={14} w={2.4} />
        </button>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------ count-up */
export function Count({ v, ready }: { v: number | string; ready: boolean }) {
  const isInt = typeof v === 'number' && Number.isInteger(v);
  const [n, setN] = useState(isInt ? 0 : v);
  useEffect(() => {
    if (!isInt) return setN(v);
    if (!ready) return setN(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(v);
    const t0 = performance.now();
    let raf = 0;
    const f = (now: number) => {
      const p = Math.min(1, (now - t0) / 900);
      setN(Math.round((v as number) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [v, ready, isInt]);
  return <>{n}</>;
}

/* ---------------------------------------------------------- sheet drill */
export type DRow = { k: K; t: string; s: string; route: string };
export function SheetDrill({ parts, sel, rowsFor, go }: { parts: [string, number][]; sel: number; rowsFor: (i: number) => DRow[]; go: (r: string) => void }) {
  const [i, setI] = useState(sel);
  const rows = rowsFor(i);
  return (
    <>
      <MSeg id="drill" tabs={parts} sel={i} onSel={setI} />
      <div>
        {rows.length ? (
          rows.map((r, j) => (
            <button key={`${r.t}-${j}`} className="row" type="button" onClick={() => go(r.route)}>
              <Si k={r.k} />
              <span className="t">
                <b>{r.t}</b>
                <span>{r.s}</span>
              </span>
              <I n="go" s={14} w={2.4} />
            </button>
          ))
        ) : (
          <Bot text="Nothing here right now." act="" />
        )}
      </div>
    </>
  );
}

/** Sets the stagger delay + draw-in class on the card element itself (`.wrap>*`). */
export function StaggerSlot({ i, drawn, children }: { i: number; drawn: boolean; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current?.nextElementSibling as HTMLElement | null;
    if (!el) return;
    el.style.animationDelay = `${i * 0.06}s`;
    el.classList.toggle('in', drawn);
  });
  return (
    <>
      <span ref={ref} hidden />
      {children}
    </>
  );
}
