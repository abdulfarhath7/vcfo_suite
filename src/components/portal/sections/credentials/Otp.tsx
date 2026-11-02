'use client';

/**
 * The OTP modal (prototype #otpm, a6_rest.js askOTP), with the real flow of
 * the previous Credentials page: on open the server sends a 6-digit code to
 * the client's Project Manager (POST /api/client/credentials/otp); six boxes,
 * auto-advance, paste; Confirm verifies (POST …/otp/verify → a 10-minute
 * grant); a wrong code shakes the row and counts down 3 tries, then a 60 s
 * lock; Resend every 30 s (POST …/otp/resend). The prototype's fixed code is
 * gone — only a code the manager received opens anything.
 */
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { CredMode, WireGrant } from '@/lib/client-portal/credentials';
import { usePortal } from '../../runtime';
import { Btn, Icon } from '../../ui';
import { fmtLeft } from './model';

interface Ticket {
  otpId: string;
  manager: { name: string; emailMasked: string };
  resendAt: string;
  expiresAt: string;
  lockedUntil: string | null;
}

const EMPTY = ['', '', '', '', '', ''];
const VERB: Record<CredMode, string> = { preview: 'to show', edit: 'to edit', reveal: 'to show' };

export function OtpModal({ mode, scope, caption, onGranted }: { mode: CredMode; scope: string; caption: string; onGranted: (g: WireGrant) => void }) {
  const { closeModal, toast } = usePortal();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [d, setD] = useState<string[]>(EMPTY);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [lockUntil, setLockUntil] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const requested = useRef(false);

  const focusBox = useCallback((i: number) => {
    const el = boxes.current[Math.max(0, Math.min(5, i))];
    el?.focus();
    el?.select();
  }, []);

  const fail = useCallback(
    (msg: string) => {
      toast(msg);
      closeModal();
    },
    [toast, closeModal],
  );

  const request = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/client/credentials/otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, scope }) });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; ticket?: Ticket; error?: string; lockedUntil?: string };
      if (out.ok && out.ticket) {
        setTicket(out.ticket);
        window.setTimeout(() => focusBox(0), 30);
      } else if (out.error === 'locked' && out.lockedUntil) {
        setLockUntil(new Date(out.lockedUntil).getTime());
        setNow(Date.now());
      } else if (out.error === 'too_many_requests') fail('Too many codes asked for in the last hour. Try again later, or call your Project Manager.');
      else if (out.error === 'no_manager') fail('No Project Manager is assigned yet, so no code can be sent. Ask SBC to assign one.');
      else fail('Could not send the code. Try again.');
    } catch {
      fail('Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  }, [mode, scope, focusBox, fail]);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void request();
  }, [request]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const locked = lockUntil > now;
  useEffect(() => {
    if (lockUntil && lockUntil <= now) {
      setLockUntil(0);
      setErr('');
      setInfo('');
      setD(EMPTY);
      if (!ticket) void request();
      else window.setTimeout(() => focusBox(0), 0);
    }
  }, [now, lockUntil, ticket, request, focusBox]);

  const resendMs = ticket ? Math.max(0, new Date(ticket.resendAt).getTime() - now) : 30_000;
  const canResend = Boolean(ticket) && resendMs <= 0 && !locked && !busy;
  const full = d.every(Boolean);

  const wrong = () => {
    setShake((n) => n + 1);
    setD(EMPTY);
    window.setTimeout(() => focusBox(0), 0);
  };

  const verify = async (code = d.join('')) => {
    if (!ticket || locked || busy) return;
    if (code.length < 6) {
      setErr('Enter all 6 digits.');
      focusBox(d.indexOf(''));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/client/credentials/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ otpId: ticket.otpId, code }) });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; grant?: WireGrant; error?: string; triesLeft?: number; lockedUntil?: string };
      if (out.ok && out.grant) {
        onGranted(out.grant);
        return;
      }
      setInfo('');
      if (out.error === 'locked' && out.lockedUntil) {
        setErr('');
        setLockUntil(new Date(out.lockedUntil).getTime());
        setNow(Date.now());
        setD(EMPTY);
        return;
      }
      if (out.error === 'wrong_code') {
        setErr('That code is not right. Try again.');
        setInfo(out.triesLeft === 1 ? '1 try left' : `${out.triesLeft ?? 2} tries left`);
      } else if (out.error === 'expired') setErr('This code has expired. Resend a new code.');
      else setErr('Could not check the code. Try again.');
      wrong();
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
      const res = await fetch('/api/client/credentials/otp/resend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ otpId: ticket.otpId }) });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; ticket?: Ticket; error?: string; lockedUntil?: string };
      if (out.ok && out.ticket) {
        setTicket(out.ticket);
        setD(EMPTY);
        setErr('');
        setInfo(`A new code was sent to ${out.ticket.manager.name}.`);
        window.setTimeout(() => focusBox(0), 0);
      } else if (out.error === 'locked' && out.lockedUntil) setLockUntil(new Date(out.lockedUntil).getTime());
      else setErr('Could not send a new code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const digits = v.replace(/\D/g, '');
    if (!digits) {
      setD((cur) => cur.map((x, j) => (j === i ? '' : x)));
      return;
    }
    const next = [...d];
    let k = i;
    for (const ch of digits) {
      if (k > 5) break;
      next[k++] = ch;
    }
    setD(next);
    if (next.every(Boolean)) void verify(next.join(''));
    else focusBox(Math.min(5, k));
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !d[i] && i > 0) {
      e.preventDefault();
      setD((cur) => cur.map((x, j) => (j === i - 1 ? '' : x)));
      focusBox(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) focusBox(i - 1);
    else if (e.key === 'ArrowRight' && i < 5) focusBox(i + 1);
    else if (e.key === 'Enter') void verify();
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
    if (t.length >= 6) {
      e.preventDefault();
      const next = t.slice(0, 6).split('');
      setD(next);
      void verify(next.join(''));
    }
  };

  const who = ticket?.manager;
  return (
    <div className="modal otpbox" role="dialog" aria-modal="true" aria-labelledby="otpt">
      <div className="lockring">
        <Icon name="lock" size={30} />
      </div>
      <h3 id="otpt">Just confirming it&apos;s you</h3>
      <div className="subx">
        A quick one-time code {VERB[mode]} {caption}.
      </div>
      {locked ? (
        <div className="banner over" style={{ textAlign: 'left' }}>
          <Icon name="alert" />
          <div>
            <b>Too many wrong codes</b>
            <span>Try again in {fmtLeft(lockUntil - now)}.</span>
          </div>
        </div>
      ) : (
        <div key={shake} className={'otp' + (shake ? ' shake' : '')} id="otprow">
          {d.map((v, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              value={v}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={`Digit ${i + 1}`}
              className={v ? 'filled' : undefined}
              disabled={!ticket || busy}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={onPaste}
              onFocus={(e) => e.target.select()}
            />
          ))}
        </div>
      )}
      {err ? (
        <p className="small otp-err" role="alert">
          {err}
          {info ? ` · ${info}` : ''}
        </p>
      ) : info ? (
        <p className="small" style={{ textAlign: 'center' }}>
          {info}
        </p>
      ) : null}
      <p className="small" style={{ textAlign: 'center' }}>
        {who ? `Code sent to ${who.name} (${who.emailMasked})` : busy ? 'Sending the code to your Project Manager…' : 'The code goes to your Project Manager at SBC.'}
        {ticket && !locked ? (
          <>
            {' · '}
            {canResend ? (
              <button type="button" className="otp-link" onClick={() => void resend()}>
                Resend
              </button>
            ) : (
              <span>Resend in {fmtLeft(resendMs)}</span>
            )}
          </>
        ) : null}
      </p>
      <div className="mfoot" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn" data-close>
          Not now
        </button>
        <Btn cls="pri" onClick={() => void verify()} disabled={!ticket || locked || busy || !full}>
          Confirm
        </Btn>
      </div>
    </div>
  );
}
