'use client';

/**
 * PAN / TAN reveal — board `s/home/v7p_ids_password.dc.html` (route key
 * `ids-password`, desktop / tablet modal) and the phone bottom sheet "Show PAN"
 * from `s/home/mobile.html`.
 *
 * The client confirms with their OWN account password; the server
 * (`POST /api/client/identifiers/reveal`) checks it with bcrypt, allows 3 tries
 * then locks for 60 s, audits `identifiers.reveal` and returns the value once.
 * On success the dialog closes, toasts "PAN shown for 60 s" and publishes the
 * value for 60 s through `useRevealedIdentifier(field)` (and `onRevealed`), so
 * the Company IDs card can show it in green and re-mask it automatically.
 *
 * Usage (Home › Company IDs card):
 *   const pan = useRevealedIdentifier('pan');          // string | null
 *   {open && <IdsRevealDialog field="pan" onClose={() => setOpen(false)} />}
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { usePortalOptional } from '@/components/client-portal/PortalProvider';
import { InfoPopover } from '@/components/client-portal/shared';
import '../../css/credentials-ids.css';

const REVEAL_MS = 60_000;

/* ---------- revealed values, shared with the Company IDs card ---------- */
type Revealed = Partial<Record<'pan' | 'tan', { value: string; until: number }>>;
let revealed: Revealed = {};
const listeners = new Set<() => void>();
const timers: Partial<Record<'pan' | 'tan', ReturnType<typeof setTimeout>>> = {};
function emit() {
  for (const l of listeners) l();
}
function publish(field: 'pan' | 'tan', value: string) {
  revealed = { ...revealed, [field]: { value, until: Date.now() + REVEAL_MS } };
  if (timers[field]) clearTimeout(timers[field]);
  timers[field] = setTimeout(() => {
    const next = { ...revealed };
    delete next[field];
    revealed = next;
    emit();
  }, REVEAL_MS);
  emit();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
/** The clear PAN / TAN while its 60-second window is open, else null. */
export function useRevealedIdentifier(field: 'pan' | 'tan'): string | null {
  return useSyncExternalStore(
    subscribe,
    () => revealed[field]?.value ?? null,
    () => null,
  );
}

function fmtS(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const EYE_DUO = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <path className="duo" d="M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z" />
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z" />
  </svg>
);
const EYE_OFF = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M10.7 5.6A10 10 0 0 1 21.5 12a17 17 0 0 1-2.2 3.1 M6.6 6.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 5.4-1.6 M3 3l18 18 M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);
const ALERT = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <path className="duo" d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3Z" />
    <path d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3Z M12 8v4.6 M12 15.8v.1" />
  </svg>
);
const LOCK13 = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-2px' }}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const S_DLG: CSSProperties = {
  width: 'min(400px,100%)',
  maxHeight: '100%',
  overflow: 'hidden',
  background: 'var(--panel)',
  borderRadius: 12,
  boxShadow: '0 24px 60px -20px oklch(15% 0.05 258 / 0.55)',
  display: 'flex',
  flexDirection: 'column',
};

export function IdsRevealDialog({
  field,
  onClose,
  onRevealed,
}: {
  field: 'pan' | 'tan';
  onClose: () => void;
  /** Optional: the clear value on success (also published via useRevealedIdentifier). */
  onRevealed?: (value: string) => void;
}) {
  const portal = usePortalOptional();
  const label = field.toUpperCase();
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [phone, setPhone] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const dlgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    setHost(document.querySelector('.cp') ?? document.body);
    const mq = window.matchMedia('(max-width: 767px)');
    setPhone(mq.matches);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    document.querySelector('.cp')?.classList.add('sheet-open');
    return () => {
      mq.removeEventListener('change', on);
      document.querySelector('.cp')?.classList.remove('sheet-open');
    };
  }, []);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
    return () => clearTimeout(t);
  }, [phone, host]);

  const close = useCallback(() => {
    onClose();
    const el = opener.current as HTMLElement | null;
    if (el?.focus) setTimeout(() => el.focus({ preventScroll: true }), 0);
  }, [onClose]);

  const locked = lockedUntil > now;
  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(0);
        setErr(null);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Tab' && dlgRef.current) {
        const f = Array.from(dlgRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]'));
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [close]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || locked || !pw) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/client/identifiers/reveal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ field, password: pw }),
      });
      const out = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        value?: string;
        error?: string;
        triesLeft?: number;
        lockedUntil?: string;
      };
      if (out.ok && out.value) {
        publish(field, out.value);
        onRevealed?.(out.value);
        portal?.toast(`${label} shown for 60 s`);
        close();
        return;
      }
      setPw('');
      if (out.error === 'locked' && out.lockedUntil) {
        setLockedUntil(new Date(out.lockedUntil).getTime());
        setNow(Date.now());
        setErr(null);
      } else if (out.error === 'wrong_password') {
        const n = out.triesLeft ?? 0;
        setErr(`Wrong password. ${n} ${n === 1 ? 'try' : 'tries'} left.`);
      } else if (out.error === 'not_recorded') {
        setErr(`Your ${label} is not recorded yet.`);
      } else {
        setErr('Could not check your password. Try again.');
      }
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch {
      setErr('Could not check your password. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!host) return null;
  const bad = Boolean(err) || locked;
  const lockBox = locked ? (
    <div className="ip-lock" role="status" aria-live="polite">
      Too many tries. Try again in <span className="mono">{fmtS(lockedUntil - now)}</span>
    </div>
  ) : null;
  const errLine = err ? (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--over-text)', fontSize: 12, fontWeight: 700, marginTop: 6 }}>
      {ALERT}
      {err}
    </div>
  ) : null;

  const body = phone ? (
    <>
      <div className="scrim" role="presentation" onClick={close} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="ip-sh-t" ref={dlgRef}>
        <div className="grab">
          <i />
        </div>
        <div className="sh">
          <h3 id="ip-sh-t">Show {label}</h3>
          <button className="ib" type="button" aria-label="Close" onClick={close}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="body">
          <form style={{ padding: '4px 14px 10px', display: 'grid', gap: 10 }} onSubmit={submit}>
            <label style={{ font: '600 12px var(--font-sans),sans-serif' }}>
              Your password
              <input
                ref={inputRef}
                type="password"
                autoComplete="current-password"
                value={pw}
                disabled={locked}
                onChange={(e) => setPw(e.target.value)}
                aria-invalid={bad || undefined}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 44,
                  marginTop: 6,
                  borderRadius: 8,
                  border: `1px solid ${bad ? 'var(--over)' : 'var(--border)'}`,
                  padding: '0 12px',
                  font: '500 15px var(--font-sans),sans-serif',
                  background: 'var(--panel)',
                  color: 'var(--fg)',
                }}
              />
            </label>
            {errLine}
            {lockBox}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{LOCK13} Shown for 60 seconds, then hidden again.</span>
            <a href="/auth/reset-password" style={{ fontSize: 12 }}>
              Forgot password?
            </a>
            <button className="btn btn-n" type="submit" disabled={busy || locked || !pw}>
              {busy ? 'Checking…' : `Show ${label}`}
            </button>
          </form>
        </div>
      </section>
    </>
  ) : (
    <>
      <div className="ip-dim" role="presentation" onClick={close} />
      <div className="ip-wrap">
        <div role="dialog" aria-modal="true" aria-labelledby="ip-t" style={S_DLG} ref={dlgRef}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div id="ip-t" style={{ font: '600 15px var(--font-sans),sans-serif', color: 'var(--navy-ink,var(--navy))' }}>
                Confirm it&apos;s you
                <InfoPopover askAbout={`showing the ${label}`}>Enter your password to show your {label}</InfoPopover>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <form id="ip-form" style={{ padding: '16px 18px' }} onSubmit={submit}>
            <label htmlFor="ip-pw" className="lbl" style={{ color: 'var(--navy-ink,var(--navy))' }}>
              Password
            </label>
            <div
              className={`ip-row${bad ? ' bad' : ''}`}
              style={{ display: 'flex', alignItems: 'center', height: 40, borderRadius: 6, padding: '0 6px 0 12px', marginTop: 6, border: `1.5px solid ${bad ? 'var(--over)' : 'var(--border)'}` }}
            >
              <input
                id="ip-pw"
                ref={inputRef}
                className="ip-in"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={pw}
                disabled={locked}
                aria-invalid={bad || undefined}
                onChange={(e) => setPw(e.target.value)}
              />
              <button
                type="button"
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                onClick={() => setShow((s) => !s)}
                style={{ width: 30, height: 30, border: 0, borderRadius: 6, background: 'var(--raised)', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                {show ? EYE_OFF : EYE_DUO}
              </button>
            </div>
            {errLine}
            {lockBox}
            <a href="/auth/reset-password" style={{ fontSize: 12, display: 'inline-block', marginTop: 8 }}>
              Forgot password?
            </a>
          </form>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--raised)' }}>
            <span style={{ flex: 1, display: 'flex' }}>
              <InfoPopover askAbout={`showing the ${label}`} below={false}>
                Shown for 60 seconds
              </InfoPopover>
            </span>
            <button type="button" className="btn btn-o" onClick={close}>
              Cancel
            </button>
            <button type="submit" form="ip-form" className="btn btn-p" disabled={busy || locked || !pw}>
              {busy ? 'Checking…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(<div className="cp-ids">{body}</div>, host);
}
