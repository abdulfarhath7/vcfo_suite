'use client';

/**
 * Compliances board atoms — React ports of the prototype helpers in
 * s/comp/index.html: icons `I`, solid glyphs (rule 18), status / area chips,
 * portal ↗ (rule 15), 📎 proof chip, sliding pill `.seg`, focus track (E),
 * date tile, and the page-wide [data-tip] tooltip wiring (rule 14/17).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { usePortal } from '../../PortalProvider';
import {
  AREA_FULL,
  ST,
  ST_TIP,
  portalFor,
  type AreaCode,
  type CompStatus,
  type PortalFiling,
  type TrackNode,
} from '@/lib/client-portal/compliances';

/* ---------------------------------------------------------------- icons */

function sv(p: string, s = 16, w = 2, style?: CSSProperties) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      dangerouslySetInnerHTML={{ __html: p }}
    />
  );
}
const P = {
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  file: '<path d="M7 3.5h7l4 4V20.5H7Z M14 3.5v4h4 M9.5 12.5h6 M9.5 16h6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.2"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 7.5v6M12 16.8v.2"/><circle cx="12" cy="12" r="9"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  down: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>',
  ext: '<path d="M14 5h5v5M19 5l-8 8M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  clip: '<path d="M15.5 7.5 9 14a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.6-5.6l-7 7a6 6 0 0 0 8.5 8.5l5.8-5.8"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  bell: '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0"/>',
};
export const I = {
  cal: (s = 16) => sv(P.cal, s),
  file: (s = 16) => sv(P.file, s),
  info: (s = 16) => sv(P.info, s),
  chevL: (s = 16) => sv(P.chevL, s),
  chevR: (s = 16) => sv(P.chevR, s),
  chevD: (s = 16) => sv(P.chevD, s),
  x: (s = 16) => sv(P.x, s),
  check: (s = 16) => sv(P.check, s, 2.6),
  alert: (s = 16) => sv(P.alert, s, 2.4),
  clock: (s = 16) => sv(P.clock, s),
  eye: (s = 16) => sv(P.eye, s),
  down: (s = 16) => sv(P.down, s),
  arrow: (s = 16) => sv(P.arrow, s),
  user: (s = 16) => sv(P.user, s),
  ext: (s = 14) => sv(P.ext, s, 2),
  clip: (s = 12) => sv(P.clip, s, 2),
  bell: (s = 16) => sv(P.bell, s),
  gear: (s = 17) => sv(P.gear, s, 2),
};

/* ------------------------------------------------- rule 18 · solid glyphs */

type GlyphKey = 'done' | 'prog' | 'you' | 'sbc' | 'up' | 'late';
const GLYPH: Record<GlyphKey, [string, string, string]> = {
  done: ['var(--ok)', '<path d="M7 12.5l3.2 3.2L17 9"/>', '#fff'],
  prog: ['var(--navy)', '<circle cx="12" cy="12" r="5"/><path d="M12 9.5V12l1.8 1.2"/>', '#f3d58a'],
  you: ['var(--due)', '<circle cx="12" cy="9.5" r="2.6"/><path d="M7.5 17c.6-2.4 2.4-3.8 4.5-3.8s3.9 1.4 4.5 3.8"/>', '#fff'],
  sbc: ['var(--prog)', '<path d="M7 12h10M13 8l4 4-4 4"/>', '#fff'],
  up: ['oklch(93% 0.008 255)', '', '#fff'],
  late: ['var(--over)', '<path d="M12 7.5v5.5M12 16.3v.2"/>', '#fff'],
};
export function Glyph({ k, size = 16, tip }: { k: GlyphKey; size?: number; tip?: string }) {
  const [bg, path, fg] = GLYPH[k];
  return (
    <span
      className="gly"
      {...(tip ? { 'data-tip': tip, 'aria-label': tip, role: 'img' } : {})}
      style={{
        width: size,
        height: size,
        background: bg,
        ...(k === 'up' ? { boxShadow: 'inset 0 0 0 1.5px oklch(84% 0.015 255)' } : {}),
      }}
    >
      {path ? (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={fg}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: path }}
        />
      ) : null}
    </span>
  );
}
const ST_GLYPH: Record<CompStatus, GlyphKey> = { ok: 'done', due: 'prog', over: 'late', up: 'up' };

export function Chip({ s }: { s: CompStatus }) {
  return (
    <span className={`chip ${ST[s].c}`} data-tip={ST_TIP[s]} aria-label={ST_TIP[s]}>
      <Glyph k={ST_GLYPH[s]} size={12} />
      {ST[s].l}
    </span>
  );
}
/** Drill-down table chip: solid fill, white text. */
export const SOLID: Record<CompStatus, string> = { ok: 'var(--ok-chip)', due: 'var(--due-chip)', over: 'var(--over-chip)', up: 'oklch(54% 0.026 258)' };

export function AreaChip({ a }: { a: AreaCode }) {
  return (
    <span className="area" data-tip={AREA_FULL[a]} aria-label={AREA_FULL[a]}>
      {a}
    </span>
  );
}

/* ------------------------------------------------- rule 15 · ↗ and 📎 */

export function PortalBtn({ f, dark = false }: { f: Pick<PortalFiling, 'area' | 'name'>; dark?: boolean }) {
  const [n, u] = portalFor(f);
  return (
    <a
      className={`pbtn${dark ? ' dark' : ''}`}
      href={u}
      target="_blank"
      rel="noopener noreferrer"
      data-tip={`Open ${n}`}
      aria-label={`Open ${n}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {I.ext(14)}
    </a>
  );
}

export function ProofChip({ f, onOpen }: { f: PortalFiling; onOpen: (f: PortalFiling) => void }) {
  if (!f.filedOn) return null;
  if (f.proofCount === 0)
    return (
      <span className="chip c-due" data-tip="SBC will upload the proof" aria-label="Proof pending · SBC will upload the proof">
        Proof pending
      </span>
    );
  return (
    <button
      type="button"
      className="chip pchip"
      data-tip="Open proof"
      aria-label={`Open proof · ${f.name} · ${f.period}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(f);
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {I.clip(12)}Proof
    </button>
  );
}

export function NameWithLinks({ f, dark }: { f: PortalFiling; dark?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {f.name}
      <PortalBtn f={f} dark={dark} />
    </span>
  );
}

/* ------------------------------------------------------- date tile */

export function DateTile({ iso, bg, w = 44, h = 48, big, small, style }: { iso?: string; bg: string; w?: number; h?: number; big: ReactNode; small: ReactNode; style?: CSSProperties }) {
  void iso;
  return (
    <div className="dtile" style={{ background: bg, width: w, height: h, ...style }}>
      <b style={w < 44 ? { fontSize: w <= 38 ? 15 : 16 } : w > 50 ? { fontSize: 24 } : undefined}>{big}</b>
      <small>{small}</small>
    </div>
  );
}

/* ------------------------------------------------- sliding pill (.seg) */

export function Seg({
  opts,
  on,
  onPick,
  counts,
  dots,
  label,
  className,
  style,
  same,
}: {
  opts: ReactNode[];
  on: number;
  onPick: (i: number) => void;
  counts?: (number | null)[];
  dots?: (string | null)[];
  label?: string;
  className?: string;
  style?: CSSProperties;
  /** Clicking the already-selected tab (prototype P:288). */
  same?: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const th = el.querySelector<HTMLElement>('.thumb');
    const b = el.querySelectorAll<HTMLElement>('button')[on];
    if (th && b) {
      th.style.width = `${b.offsetWidth}px`;
      th.style.transform = `translateX(${b.offsetLeft}px)`;
    }
  }, [on]);
  useLayoutEffect(() => {
    place();
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => place());
    ro.observe(el);
    void document.fonts?.ready.then(place);
    return () => ro.disconnect();
  }, [place]);
  return (
    <div className={`seg${className ? ` ${className}` : ''}`} ref={ref} role="tablist" aria-label={label} style={style}>
      <span className="thumb" />
      {opts.map((o, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          className={i === on ? 'on' : ''}
          aria-selected={i === on}
          onClick={() => (i === on ? same?.(i) : onPick(i))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const n = (i + (e.key === 'ArrowRight' ? 1 : opts.length - 1)) % opts.length;
              onPick(n);
              requestAnimationFrame(() => ref.current?.querySelectorAll<HTMLElement>('button')[n]?.focus());
            }
          }}
        >
          {dots?.[i] ? <span className="dot" style={{ background: dots[i]! }} /> : null}
          {o}
          {counts && counts[i] != null ? <span className="cnt">{counts[i]}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------ flow E · focus track */

export function FocusTrack({ nodes }: { nodes: TrackNode[] }) {
  const total = nodes.length;
  const out: ReactNode[] = [];
  nodes.forEach((n, i) => {
    if (i) {
      const prevDone = nodes[i - 1]!.st === 'done' && (n.st === 'done' || n.st === 'cur');
      out.push(<span key={`l${i}`} className={`ft-line ${prevDone ? 'done' : 'todo'}`} />);
    }
    if (n.st === 'cur')
      out.push(
        <div key={i} className="ft-cur" data-tip={n.tip} aria-label={n.tip} tabIndex={0} role="img">
          <span className="ft-ic">{n.icon === 'person' ? I.user(17) : n.icon === 'check' ? I.check(17) : n.icon === 'file' ? I.file(17) : I.gear(17)}</span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="ft-eye">
              Now · {i + 1} of {total}
            </span>
            <b>{n.label}</b>
            <small>{n.sub}</small>
          </span>
        </div>,
      );
    else
      out.push(
        <div key={i} className="ft-st">
          <Glyph k={n.st === 'done' ? 'done' : n.st === 'you' ? 'you' : 'up'} size={28} tip={n.tip} />
          <span className={`ft-l ${n.st === 'done' ? '' : 'muted'}`}>
            {n.label}
            <small>{n.sub}</small>
          </span>
        </div>,
      );
  });
  return <div className="ft">{out}</div>;
}

/* ------------------------------------------- page-wide [data-tip] tips */

/**
 * The prototype's `.tipb`: one navy tooltip for every `[data-tip]` in the page
 * (hover after 120 ms, keyboard focus too), drawn by the portal's #vp-tip so
 * it is never clipped by the calendar's overflow.
 */
export function usePageTips(root: RefObject<HTMLElement | null>) {
  const { tipAt } = usePortal();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cur: Element | null = null;
    const hide = () => {
      if (timer) clearTimeout(timer);
      cur = null;
      tipAt(0, 0, null);
    };
    const show = (t: Element | null) => {
      const target = t?.closest?.('[data-tip]') ?? null;
      if (!target || !el.contains(target)) return hide();
      if (target === cur) return;
      cur = target;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const r = target.getBoundingClientRect();
        tipAt(r.left + r.width / 2, r.top + 8, target.getAttribute('data-tip'));
      }, 120);
    };
    const over = (e: Event) => show(e.target as Element);
    const focus = (e: Event) => {
      if ((e.target as HTMLElement).matches?.(':focus-visible')) show(e.target as Element);
    };
    el.addEventListener('mouseover', over);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('focusin', focus);
    el.addEventListener('focusout', hide);
    el.addEventListener('pointerdown', hide, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      el.removeEventListener('mouseover', over);
      el.removeEventListener('mouseleave', hide);
      el.removeEventListener('focusin', focus);
      el.removeEventListener('focusout', hide);
      el.removeEventListener('pointerdown', hide, true);
      window.removeEventListener('scroll', hide, true);
      if (timer) clearTimeout(timer);
      tipAt(0, 0, null);
    };
  }, [root, tipAt]);
}

/** Count-up 0 → n over 700 ms easeOutCubic (G-07), skipped under reduced motion. */
export function CountUp({ n, svg = false }: { n: number; svg?: boolean }) {
  const ref = useRef<HTMLSpanElement & SVGTSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = String(n);
      return;
    }
    let s: number | null = null;
    let raf = 0;
    const step = (ts: number) => {
      s = s ?? ts;
      const k = Math.min(1, (ts - s) / 700);
      el.textContent = String(Math.round(n * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return svg ? <tspan ref={ref}>{n}</tspan> : <span ref={ref}>{n}</span>;
}

/** Esc + outside-click close for pop-overs. */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, closeFn: () => void, ignore?: (t: Element) => boolean) {
  const closeRef = useRef(closeFn);
  closeRef.current = closeFn;
  const ignoreRef = useRef(ignore);
  ignoreRef.current = ignore;
  useEffect(() => {
    if (!open) return;
    const close = () => closeRef.current();
    const ignore = ignoreRef.current;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (ref.current && !ref.current.contains(t) && !(ignore && ignore(t))) close();
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', down, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', down, true);
    };
  }, [open, ref]);
}

/** Focus trap + Esc for modal dialogs; returns focus to the opener on close. */
export function useModal(ref: RefObject<HTMLElement | null>, closeFn: () => void) {
  const closeRef = useRef(closeFn);
  closeRef.current = closeFn;
  useEffect(() => {
    const close = () => closeRef.current();
    const last = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus],button,a[href]')?.focus({ preventScroll: true }), 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"],input,select')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]!;
      const lastEl = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', key, true);
      last?.focus?.({ preventScroll: true });
    };
  }, [ref]);
}
