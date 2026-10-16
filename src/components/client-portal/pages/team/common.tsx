'use client';

/**
 * Shared pieces of the five "team" pages (Team, Announcements, Notifications,
 * Audit, Settings): the board dialog (`.ov.tb-ov > .dlg`, bottom sheet on phones
 * for drill-downs), the rule-16 bot bubble, the navy sliding pill, the (i)
 * pop-over and small helpers. Markup copied from the FINAL boards.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { usePortal } from '../../PortalProvider';
import { VisorHead } from '../../Visor';

/* ------------------------------------------------------------------ */
/* icons (paths copied from the boards)                                 */
/* ------------------------------------------------------------------ */

export const P = {
  userPlus: 'M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M18 8v6 M15 11h6',
  users: 'M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M15.5 5.7a3.3 3.3 0 0 1 0 6.4',
  wa: 'M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z M9.2 8.8c.2-.4.6-.4.9-.2l.8 1.4c.1.3 0 .6-.2.8l-.4.4c.4.9 1.2 1.7 2.1 2.1l.4-.4c.2-.2.5-.3.8-.2l1.4.8c.3.2.3.6.1.9-.5.8-1.4 1.1-2.3.7a7 7 0 0 1-3.7-3.7c-.4-.9-.1-1.8.1-2.6Z',
  waShort: 'M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4Z',
  call: 'M7 4h2.2l1.3 3.6-1.8 1.2a10 10 0 0 0 6.5 6.5l1.2-1.8L20 14.8V17a2 2 0 0 1-2 2A14 14 0 0 1 5 6a2 2 0 0 1 2-2Z',
  mail: 'M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5',
  teams: 'M3.5 7h10v10h-10Z M6.5 10h4 M8.5 10v5 M16.5 9.5a2 2 0 1 0 0-4a2 2 0 1 0 0 4Z M15.5 11h5v4.5a2.5 2.5 0 0 1-5 0',
  resend: 'M4.5 12a7.5 7.5 0 0 1 13-5 M19.5 12a7.5 7.5 0 0 1-13 5 M17.5 3.5v3.5H14 M6.5 20.5V17H10',
  x: 'M6 6l12 12M18 6 6 18',
  swap: 'M4 8h13l-3.5-3.5 M20 16H7l3.5 3.5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  copy: 'M9 9h10v11H9Z M5 15V4h10',
  send: 'M4 12 20 4l-4 16-4-7Z M12 13l8-9',
  arrowR: 'M4 12h16 M14 6l6 6-6 6',
  warn: 'M12 4 21 20H3Z M12 10v4 M12 17h.01',
  bank: 'M3.5 20.5h17 M5 20.5V10 M9.5 20.5V10 M14.5 20.5V10 M19 20.5V10 M3 10h18L12 3.5Z',
  ext: 'M7 17 17 7 M9 7h8v8',
  circular: 'M7 3.5h7l4 4v13H7Z M14 3.5v4h4 M10 13h5 M10 16.5h5',
  prev: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  go: 'M5 12h14 M12 5l7 7-7 7',
  bell: 'M10.268 21a2 2 0 0 0 3.464 0 M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13Z M16 16l4 4',
  download: 'M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15 M12 4.5V15 M7.8 10.8 12 15l4.2-4.2',
  chevron: 'M6 9l6 6 6-6',
  check: 'M5 12.5 10 17.5 19 7',
};

export function Svg({
  d,
  size = 15,
  sw = 2,
  style,
  join = true,
}: {
  d: string;
  size?: number;
  sw?: number;
  style?: CSSProperties;
  join?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin={join ? 'round' : undefined}
      aria-hidden="true"
      style={style}
    >
      <path d={d} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
}

/** Stable avatar colour per person (the board's demo palette). */
const AV = [
  'oklch(52% 0.13 330)',
  'oklch(50% 0.12 200)',
  'oklch(62% 0.08 40)',
  'oklch(55% 0.09 200)',
  'oklch(52% 0.12 150)',
  'oklch(54% 0.14 280)',
];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
}

export const IST = 'Asia/Kolkata';
export function dayMonth(iso: string): { d: string; m: string } {
  const dt = new Date(iso);
  return {
    d: dt.toLocaleDateString('en-GB', { day: 'numeric', timeZone: IST }),
    m: dt.toLocaleDateString('en-GB', { month: 'short', timeZone: IST }),
  };
}
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: IST });
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

/** Rule 12 / DECISIONS "Loading": skeleton after 150 ms, held at least 300 ms. */
export function useSkeleton(loading: boolean): boolean {
  const [show, setShow] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => {
        since.current = Date.now();
        setShow(true);
      }, 150);
      return () => clearTimeout(t);
    }
    if (!show) return;
    const left = Math.max(0, 300 - (Date.now() - since.current));
    const t = setTimeout(() => setShow(false), left);
    return () => clearTimeout(t);
  }, [loading, show]);
  return show;
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { 'content-type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/** A readable one-off temporary password (interim sign-in until the set-password link ships). */
export function makeTempPassword(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const a = 'abcdefghijkmnpqrstuvwxyz';
  const n = '23456789';
  const s = '#@!$%';
  const rnd = new Uint32Array(10);
  crypto.getRandomValues(rnd);
  const pick = (set: string, i: number) => set[rnd[i] % set.length];
  return `${pick(A, 0)}${pick(a, 1)}${pick(a, 2)}${pick(a, 3)}${pick(s, 4)}${pick(n, 5)}${pick(n, 6)}${pick(n, 7)}${pick(A, 8)}${pick(a, 9)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* sliding pill (.seg)                                                  */
/* ------------------------------------------------------------------ */

export function Seg({
  tabs,
  active,
  onPick,
  label,
  grid = true,
  style,
  btnStyle,
  wrap = true,
}: {
  tabs: Array<{ label: string; cnt?: number | string }>;
  active: number;
  onPick: (i: number) => void;
  label?: string;
  grid?: boolean;
  style?: CSSProperties;
  btnStyle?: CSSProperties;
  wrap?: boolean;
}) {
  const n = tabs.length;
  const seg = (
    <div
      className="seg"
      role="tablist"
      aria-label={label}
      style={{ ...(grid ? { gridTemplateColumns: `repeat(${n},minmax(0,1fr))` } : {}), ...style }}
    >
      <span className="thumb" style={{ width: `calc((100% - 4px)/${n})`, transform: `translateX(${active * 100}%)` }} />
      {tabs.map((t, i) => (
        <button
          key={t.label}
          type="button"
          role="tab"
          aria-selected={i === active}
          className={i === active ? 'on' : ''}
          style={btnStyle}
          onClick={() => onPick(i)}
        >
          {t.label}
          {t.cnt !== undefined ? <span className="cnt">{t.cnt}</span> : null}
        </button>
      ))}
    </div>
  );
  return wrap ? <div className="tb-segx">{seg}</div> : seg;
}

/* ------------------------------------------------------------------ */
/* bot bubble (rule 16, board markup)                                   */
/* ------------------------------------------------------------------ */

export function Bot({ size = 48, answered = false }: { size?: number; answered?: boolean }) {
  const head = Math.round(size * 0.74);
  return (
    <span className={`bface${answered ? ' ans' : ''}`} aria-hidden="true" style={{ width: size, height: size }}>
      <VisorHead style={{ width: head, height: Math.round(head * 1.26), marginTop: Math.round(head * 0.3) }} />
    </span>
  );
}

export function BotBubble({
  size = 48,
  answered = false,
  react = false,
  padding,
  children,
}: {
  size?: number;
  answered?: boolean;
  react?: boolean;
  padding: string;
  children: ReactNode;
}) {
  return (
    <div className="tb-bot" style={{ padding }}>
      <span className={react ? 'react' : undefined} style={{ display: 'flex', flex: 'none' }}>
        <Bot size={size} answered={answered} />
      </span>
      <div role="status" className="tb-bubble">
        {children}
      </div>
    </div>
  );
}

/** "Ask VCFO why" text link (opens the chat). */
export function AskWhy({ q }: { q: string }) {
  const { openChat } = usePortal();
  return (
    <a
      href="#"
      style={{ fontSize: 12 }}
      onClick={(e) => {
        e.preventDefault();
        openChat(q);
      }}
    >
      Ask VCFO why
    </a>
  );
}

/** (i) pop-over, board markup: `.info > button + .pop` ending with "Ask VCFO about this". */
export function Info({
  label,
  children,
  about,
  popStyle,
  size = 15,
}: {
  label: string;
  children: ReactNode;
  about: string;
  popStyle?: CSSProperties;
  size?: number;
}) {
  const { openChat } = usePortal();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', out);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return (
    <span className={`info${open ? ' open' : ''}`} ref={ref}>
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      </button>
      <span className="pop" role="tooltip" style={popStyle}>
        {children}
        <a
          className="ask"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setOpen(false);
            openChat(`Tell me about ${about}`);
          }}
        >
          <span style={{ width: 16, height: 16, display: 'inline-flex', overflow: 'hidden', flex: 'none' }}>
            <VisorHead style={{ width: 16, height: 20, marginTop: 2 }} />
          </span>
          Ask VCFO about this
        </a>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* dialog: `.ov.tb-ov(.tb-top) > .dlg`                                  */
/* ------------------------------------------------------------------ */

/** Mount pop-ups at the portal root (outside animated/transformed ancestors), keeping the page scope. */
export function TPortal({ children, tp }: { children: ReactNode; tp?: string }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(document.querySelector('.cp')), []);
  if (!host) return null;
  return createPortal(
    <div className="cp-team">
      <div className={tp}>{children}</div>
    </div>,
    host,
  );
}

export function Dialog({
  labelledBy,
  width = 460,
  top = false,
  sheet = false,
  onClose,
  children,
  dlgStyle,
  tp,
}: {
  tp?: string;
  labelledBy: string;
  width?: number;
  /** `.tb-top`: aligned to the top on desktop (drill-downs, detail). */
  top?: boolean;
  /** Phone: bottom sheet (DECISIONS "Mobile drill-downs"). */
  sheet?: boolean;
  onClose: () => void;
  children: ReactNode;
  dlgStyle?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const last = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('input,button:not([aria-label="Close"]),[href]');
      (el ?? ref.current)?.focus({ preventScroll: true });
    }, 30);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const first = f[0];
        const lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', key, true);
      last?.focus?.({ preventScroll: true });
    };
  }, []);
  return (
    <TPortal tp={tp}>
      <div
        className={`ov tb-ov${top ? ' tb-top' : ''}${sheet ? ' tb-sheet' : ''}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={ref}
          tabIndex={-1}
          className="dlg tb-dlgin"
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          style={{ width, ...dlgStyle }}
        >
          {children}
        </div>
      </div>
    </TPortal>
  );
}

export function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ibtn" aria-label="Close" style={{ marginLeft: 'auto', border: 0 }} onClick={onClick}>
      <Svg d={P.x} size={16} join={false} />
    </button>
  );
}

/** "Show in the list ↓": close, then after 60 ms smooth-scroll (NR:275, UR:258). */
export function useScrollAfterClose() {
  return useCallback((y: number) => {
    setTimeout(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }, 60);
  }, []);
}

/** Real contact deep links (TM-05). */
export function contactHref(kind: 'wa' | 'call' | 'email' | 'teams', c: { email?: string; phoneE164?: string; whatsappE164?: string }): string | null {
  const digits = (v?: string) => (v ?? '').replace(/[^\d]/g, '');
  if (kind === 'wa') return digits(c.whatsappE164 ?? c.phoneE164) ? `https://wa.me/${digits(c.whatsappE164 ?? c.phoneE164)}` : null;
  if (kind === 'call') return c.phoneE164 ? `tel:${c.phoneE164.replace(/\s+/g, '')}` : null;
  if (kind === 'email') return c.email ? `mailto:${c.email}` : null;
  return c.email ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(c.email)}` : null;
}

/** "+91 90597 90014" from "+919059790014". */
export function prettyPhone(e164?: string | null): string {
  if (!e164) return '';
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
