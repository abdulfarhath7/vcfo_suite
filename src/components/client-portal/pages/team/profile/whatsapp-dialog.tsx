'use client';

/**
 * Turn on WhatsApp (prototype settings_whatsapp, `Modal` sm): Number, Code, Done.
 *
 * C-868: when the server can send codes (`GET /api/client/account/whatsapp-code` says
 * `setUp`: WhatsApp is on and `WHATSAPP_TEMPLATE_NAME_VERIFY_CODE` names the approved
 * authentication template), the number gets a six-digit code and "Verify and turn on" checks it
 * before the opt-in is saved. Otherwise the dialog says the code check is not set up and goes
 * from Number straight to Done, as before.
 */
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tag } from '@/components/ui/spectrum-chip';
import { StepMark } from '@/components/ui/step-track';
import { cn } from '@/lib/utils';
import { Dialog, P, Svg, api, prettyPhone } from '../common';

const CODE_ERR: Record<string, string> = {
  wrong: 'That code is not right',
  expired: 'The code has expired. Send a new one.',
  locked: 'Too many tries. Send a new code.',
  too_many: 'Too many codes this hour. Try later.',
  invalid_phone: 'Enter a 10-digit Indian mobile number',
  failed: 'Could not send the code. Try again.',
};

/** Six 44 px digit boxes; typing moves on, Backspace moves back, a pasted code fills them all. */
function CodeBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const set = (i: number, d: string) => {
    const chars = value.padEnd(6, ' ').split('');
    chars[i] = d || ' ';
    onChange(chars.join('').trimEnd());
  };
  return (
    <div className="flex gap-2" role="group" aria-label="Six-digit code">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          value={value[i]?.trim() ?? ''}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '');
            if (d.length > 1) {
              onChange(d.slice(0, 6));
              refs.current[Math.min(d.length, 6) - 1]?.focus();
              return;
            }
            set(i, d);
            if (d && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i]?.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          className="box-border h-11 w-11 rounded-md border-1.5 border-line-strong bg-surface-raised text-center font-mono text-[18px] text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
        />
      ))}
    </div>
  );
}

export function WhatsAppDialog({
  phoneE164,
  company,
  onClose,
  onDone,
  patchProfile,
}: {
  phoneE164: string | null;
  company: string;
  onClose: () => void;
  onDone: (phoneE164: string) => void;
  patchProfile: (b: Record<string, unknown>) => Promise<unknown>;
}) {
  const initial = phoneE164?.startsWith('+91') ? phoneE164.slice(3).replace(/(\d{5})(\d{5})/, '$1 $2') : '';
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [setUp, setSetUp] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  useEffect(() => {
    let live = true;
    api<{ setUp: boolean }>('/api/client/account/whatsapp-code')
      .then((r) => live && setSetUp(Boolean(r.setUp)))
      .catch(() => live && setSetUp(false));
    return () => {
      live = false;
    };
  }, []);
  const [num, setNum] = useState(initial);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const digits = num.replace(/\D/g, '');
  const valid = /^[6-9]\d{9}$/.test(digits);
  const withCode = setUp === true;
  const steps = withCode ? ['Number', 'Code', 'Done'] : ['Number', 'Done'];
  const doneAt = withCode ? 2 : 1;
  const e164 = `+91${digits}`;

  const turnOn = async () => {
    await patchProfile({ phoneE164: e164, whatsappOptIn: true });
    setSaved(e164);
    setStep(doneAt as 1 | 2);
  };
  const sendCode = async () => {
    const res = await fetch('/api/client/account/whatsapp-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'send', phoneE164: e164 }),
    });
    const b = (await res.json().catch(() => ({}))) as { status?: string };
    if (b.status === 'sent') {
      setCode('');
      setStep(1);
      return;
    }
    if (b.status === 'not_set_up') {
      setSetUp(false);
      return;
    }
    setErr(CODE_ERR[b.status ?? 'failed'] ?? CODE_ERR.failed!);
  };
  const submit = async () => {
    if (!valid) return setErr('Enter a 10-digit Indian mobile number');
    if (!consent) return setErr('Tick the box to agree to WhatsApp updates');
    setBusy(true);
    setErr('');
    try {
      if (withCode) await sendCode();
      else await turnOn();
    } catch {
      setErr('Could not turn WhatsApp on. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (code.replace(/\D/g, '').length !== 6) return setErr('Enter the six digits');
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/client/account/whatsapp-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'check', phoneE164: e164, code }),
      });
      const b = (await res.json().catch(() => ({}))) as { status?: string };
      if (b.status !== 'ok') {
        setErr(CODE_ERR[b.status ?? 'failed'] ?? CODE_ERR.failed!);
        return;
      }
      await turnOn();
    } catch {
      setErr('Could not turn WhatsApp on. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const done = step === doneAt;

  return (
    <Dialog labelledBy="wa-t" width={420} onClose={done ? () => onDone(saved) : onClose} tp="tp-set">
      <div className="dlg-h" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 id="wa-t" style={{ margin: 0 }}>
            Turn on WhatsApp
          </h2>
          <div className="cp-tw mt-1.5">
            <ol className="flex items-center gap-2" aria-label="Steps">
              {steps.map((s, i) => (
                <li
                  key={s}
                  className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-medium', i === step ? 'text-ink' : i < step ? 'text-positive' : 'text-ink-muted')}
                  aria-current={i === step ? 'step' : undefined}
                >
                  <StepMark state={i < step ? 'done' : i === step ? 'now' : 'next'} size={18} />
                  {s}
                  {i < steps.length - 1 ? <span className="ml-1 text-ink-faint">›</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <button type="button" className="ibtn ghost" aria-label="Close" onClick={done ? () => onDone(saved) : onClose}>
          <Svg d={P.x} size={16} join={false} />
        </button>
      </div>
      <div className="dlg-b cp-tw">
        {step === 0 ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label htmlFor="wa-num" className="grid gap-1.5 text-[13px] font-medium text-ink-2">
              WhatsApp number
              <span className="flex gap-2">
                <span className="grid h-10 w-[64px] flex-none place-items-center rounded-md border-1.5 border-line-strong bg-surface-sunken text-[14px] text-ink-2">+91</span>
                {/* eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the number when the dialog opens */}
                <Input id="wa-num" inputMode="tel" value={num} onChange={(e) => setNum(e.target.value)} autoComplete="tel-national" autoFocus />
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-[13px] text-ink">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} aria-label="Send me WhatsApp updates" className="mt-px" />
              <span>Send me WhatsApp updates about {company}. Reply STOP to stop.</span>
            </label>
            {setUp === false ? (
              <span>
                <Tag>Code check not set up</Tag>
              </span>
            ) : null}
            {err ? (
              <span role="alert" className="text-[13px] font-medium text-danger">
                {err}
              </span>
            ) : null}
            <button type="submit" hidden />
          </form>
        ) : !done ? (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <span className="text-[13px] text-ink-2">Code sent to {prettyPhone(e164)} on WhatsApp</span>
            <CodeBoxes value={code} onChange={setCode} />
            <span className="flex items-center gap-3 text-[13px]">
              <button type="button" className="font-medium text-brand-text hover:underline" disabled={busy} onClick={() => void sendCode()}>
                Send a new code
              </button>
              <button type="button" className="font-medium text-ink-muted hover:underline" onClick={() => (setStep(0), setErr(''))}>
                Change number
              </button>
            </span>
            {err ? (
              <span role="alert" className="text-[13px] font-medium text-danger">
                {err}
              </span>
            ) : null}
            <button type="submit" hidden />
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-md bg-positive-soft text-positive">
              <Check size={18} strokeWidth={1.6} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-ink">WhatsApp is on</span>
              <span className="block text-[12.5px] text-ink-muted">{prettyPhone(saved)}</span>
            </span>
          </div>
        )}
      </div>
      <div className="dlg-f cp-tw">
        {step === 0 ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy || !valid || !consent || setUp === null} onClick={() => void submit()}>
              {withCode ? 'Send code' : 'Turn on'}
            </Button>
          </>
        ) : !done ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy || code.replace(/\D/g, '').length !== 6} onClick={() => void verify()}>
              Verify and turn on
            </Button>
          </>
        ) : (
          <Button onClick={() => onDone(saved)}>Done</Button>
        )}
      </div>
    </Dialog>
  );
}
