'use client';

/**
 * "Confirm it's you" — the Credentials OTP dialog (v7p_credentials `renderOtp`).
 * On open it asks the server to send a 6-digit code to the Project Manager
 * (never the client). Six digit boxes · Verify enabled at 6 digits · 3 wrong
 * codes lock for 60 s · resend every 30 s · Tab trapped · Esc / × / Cancel.
 * Phone: bottom sheet (`cr-up .3s`, CSS).
 */
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { CredMode, WireGrant } from '@/lib/client-portal/credentials';
import { Ic } from './Ic';

interface Ticket {
  otpId: string;
  manager: { name: string; emailMasked: string };
  resendAt: string;
  expiresAt: string;
}

function fmtS(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const EMPTY = ['', '', '', '', '', ''];

export function OtpDialog({
  mode,
  scope,
  caption,
  manager,
  engagementQuery,
  onClose,
  onGranted,
  onFail,
}: {
  mode: CredMode;
  scope: string;
  /** "Reveal · PAN", "Edit · whole page"… */
  caption: string;
  manager: { name: string; emailMasked: string } | null;
  engagementQuery: string;
  onClose: () => void;
  onGranted: (grant: WireGrant) => void;
  onFail: (msg: string) => void;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [d, setD] = useState<string[]>(EMPTY);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [lockUntil, setLockUntil] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const dlgRef = useRef<HTMLDivElement>(null);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const verifyRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const requested = useRef(false);

  const focusBox = useCallback((i: number) => {
    const el = boxes.current[i];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const request = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/client/credentials/otp${engagementQuery}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, scope }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; ticket?: Ticket; error?: string; lockedUntil?: string };
      if (out.ok && out.ticket) {
        setTicket(out.ticket);
        setTimeout(() => focusBox(0), 0);
      } else if (out.error === 'locked' && out.lockedUntil) {
        setLockUntil(new Date(out.lockedUntil).getTime());
        setNow(Date.now());
      } else if (out.error === 'too_many_requests') {
        onFail('Too many codes asked for in the last hour. Try again later, or call your Project Manager.');
      } else if (out.error === 'no_manager') {
        onFail('No Project Manager is assigned yet, so no code can be sent. Ask SBC to assign one.');
      } else {
        onFail('Could not send the code. Try again.');
      }
    } catch {
      onFail('Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  }, [engagementQuery, mode, scope, focusBox, onFail]);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void request();
    setTimeout(() => focusBox(0), 30);
  }, [request, focusBox]);

  /* clock: lock and resend countdowns */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const locked = lockUntil > now;
  useEffect(() => {
    if (lockUntil && lockUntil <= now) {
      setLockUntil(0);
      setErr('');
      setInfo('');
      setD(EMPTY);
      if (!ticket) void request();
      else setTimeout(() => focusBox(0), 0);
    }
  }, [now, lockUntil, ticket, request, focusBox]);
  useEffect(() => {
    if (locked) closeRef.current?.focus();
  }, [locked]);

  const resendMs = ticket ? Math.max(0, new Date(ticket.resendAt).getTime() - now) : 30_000;
  const canResend = Boolean(ticket) && resendMs <= 0 && !locked && !busy;
  const full = d.every(Boolean);

  const verify = async () => {
    if (!ticket || locked || busy) return;
    if (!full) {
      setErr('Enter all 6 digits.');
      setInfo('');
      focusBox(d.indexOf(''));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/client/credentials/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ otpId: ticket.otpId, code: d.join('') }),
      });
      const out = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        grant?: WireGrant;
        error?: string;
        triesLeft?: number;
        lockedUntil?: string;
      };
      if (out.ok && out.grant) {
        onGranted(out.grant);
        return;
      }
      setD(EMPTY);
      setInfo('');
      if (out.error === 'locked' && out.lockedUntil) {
        setErr('');
        setLockUntil(new Date(out.lockedUntil).getTime());
        setNow(Date.now());
        return;
      }
      if (out.error === 'wrong_code') {
        setErr('That code is not right. Try again.');
        setInfo(out.triesLeft === 1 ? '1 try left' : `${out.triesLeft ?? 2} tries left`);
      } else if (out.error === 'expired') {
        setErr('This code has expired. Resend a new code.');
      } else {
        setErr('Could not check the code. Try again.');
      }
      setTimeout(() => focusBox(0), 0);
    } catch {
      setErr('Could not check the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!ticket || !canResend) return;
    setBusy(true);
    try {
      const res = await fetch('/api/client/credentials/otp/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ otpId: ticket.otpId }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; ticket?: Ticket; error?: string; lockedUntil?: string };
      if (out.ok && out.ticket) {
        setTicket(out.ticket);
        setD(EMPTY);
        setErr('');
        setInfo(`A new code was sent to ${out.ticket.manager.name}.`);
        setTimeout(() => focusBox(0), 0);
      } else if (out.error === 'locked' && out.lockedUntil) {
        setLockUntil(new Date(out.lockedUntil).getTime());
      } else {
        setErr('Could not send a new code. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const fill = (digits: string[]) => {
    const next = EMPTY.map((_, k) => digits[k] ?? '');
    setD(next);
    const n = next.indexOf('');
    setTimeout(() => (n === -1 ? verifyRef.current?.focus() : focusBox(n)), 0);
  };

  const onInput = (i: number, value: string) => {
    const raw = value.replace(/\D/g, '');
    if (raw.length > 1) {
      fill(raw.slice(0, 6).split(''));
      return;
    }
    const next = [...d];
    next[i] = raw;
    setD(next);
    if (raw) {
      if (i < 5) setTimeout(() => focusBox(i + 1), 0);
      else setTimeout(() => verifyRef.current?.focus(), 0);
    }
  };
  const onBoxKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !d[i] && i > 0) {
      e.preventDefault();
      const next = [...d];
      next[i - 1] = '';
      setD(next);
      focusBox(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === 'ArrowRight' && i < 5) {
      e.preventDefault();
      focusBox(i + 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      void verify();
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const ds = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!ds) return;
    e.preventDefault();
    fill(ds.split(''));
  };

  /* Esc closes; Tab trapped; focus outside snaps back to the first box */
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dlgRef.current) return;
      const f = Array.from(dlgRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])'));
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      const a = document.activeElement;
      if (e.shiftKey && (a === first || !dlgRef.current.contains(a))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (a === last || !dlgRef.current.contains(a))) {
        e.preventDefault();
        first.focus();
      }
    };
    const focusIn = (e: FocusEvent) => {
      if (dlgRef.current && !dlgRef.current.contains(e.target as Node)) {
        const b = boxes.current[0];
        if (b && !b.disabled) b.focus();
        else closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', key);
    document.addEventListener('focusin', focusIn);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('focusin', focusIn);
    };
  }, [onClose]);

  const verb = mode === 'edit' ? 'Edit' : mode === 'preview' ? 'Preview' : 'Reveal';
  const mgr = ticket?.manager ?? manager;

  return (
    <div id="cr-otp">
      <div className="cr-scrim" onClick={onClose} />
      <div className="cr-dlg" id="cr-dlg" role="dialog" aria-modal="true" aria-labelledby="cr-dlg-t" ref={dlgRef}>
        <header className="cr-dh">
          <span className="cr-circ navy">
            <Ic n={mode === 'edit' ? 'pencil' : 'shield-check'} s={18} />
          </span>
          <div className="cr-dhx">
            <h2 id="cr-dlg-t" className="cr-dt">
              Confirm it&#39;s you
            </h2>
            <div className="cr-cap">
              {verb} · {caption}
            </div>
          </div>
          <button type="button" id="cr-otp-x" className="cr-ib" aria-label="Close" onClick={onClose} ref={closeRef}>
            <Ic n="x" s={14} />
          </button>
        </header>
        <div className="cr-db">
          <p className="cr-msg">
            {mgr ? (
              <>
                An OTP has been sent to your manager, <b>{mgr.name}</b>, at <span className="cr-mono">{mgr.emailMasked}</span>. Ask them for the
                code.
              </>
            ) : (
              'Sending an OTP to your manager…'
            )}
          </p>
          <div className="cr-digs" role="group" aria-label="6-digit code">
            {d.map((v, i) => (
              <input
                key={i}
                id={`cr-o${i}`}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                className={`cr-dig${err ? ' bad' : ''}`}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                aria-label={`Digit ${i + 1} of 6`}
                value={v}
                maxLength={6}
                disabled={locked}
                onChange={(e) => onInput(i, e.target.value)}
                onKeyDown={(e) => onBoxKey(i, e)}
                onPaste={onPaste}
              />
            ))}
          </div>
          <div className="cr-err" role="alert" aria-live="assertive">
            {err ? (
              <>
                {err}
                {info ? <span className="cr-ei">{info}</span> : null}
              </>
            ) : null}
          </div>
          {locked ? (
            <div className="cr-lock" role="status" aria-live="polite">
              Too many wrong codes. Try again later. <span className="cr-mono">{fmtS(lockUntil - now)}</span>
            </div>
          ) : info && !err ? (
            <div className="cr-ok" role="status" aria-live="polite">
              {info}
            </div>
          ) : null}
        </div>
        <footer className="cr-df cr-dfo">
          <button type="button" id="cr-resend" className="cr-link" disabled={!canResend} onClick={() => void resend()}>
            {canResend ? (
              'Resend code'
            ) : (
              <>
                Resend code in{' '}
                <span className="cr-mono" aria-live="polite">
                  {fmtS(resendMs)}
                </span>
              </>
            )}
          </button>
          <span className="cr-sp" />
          <button type="button" className="cr-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" id="cr-verify" className="cr-btn cr-btn-p" disabled={!full || locked || !ticket || busy} onClick={() => void verify()} ref={verifyRef}>
            Verify
          </button>
        </footer>
      </div>
    </div>
  );
}
