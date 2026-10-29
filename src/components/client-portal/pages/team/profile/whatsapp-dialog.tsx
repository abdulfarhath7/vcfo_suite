'use client';

/**
 * Turn on WhatsApp (prototype settings_whatsapp, `Modal` sm). The 6-digit code step is not
 * live: the WhatsApp transport has no approved verification template yet (QUESTIONS.md,
 * area team), so the dialog records the number and consent through the existing opt-in
 * and then shows the Done step.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { StepMark } from '@/components/ui/step-track';
import { cn } from '@/lib/utils';
import { Dialog, P, Svg, prettyPhone } from '../common';

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
  const [step, setStep] = useState<0 | 1>(0);
  const [num, setNum] = useState(initial);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const digits = num.replace(/\D/g, '');
  const valid = /^[6-9]\d{9}$/.test(digits);
  const steps = ['Number', 'Done'];

  const submit = async () => {
    if (!valid) return setErr('Enter a 10-digit Indian mobile number');
    if (!consent) return setErr('Tick the box to agree to WhatsApp updates');
    setBusy(true);
    setErr('');
    try {
      const e164 = `+91${digits}`;
      await patchProfile({ phoneE164: e164, whatsappOptIn: true });
      setSaved(e164);
      setStep(1);
    } catch {
      setErr('Could not turn WhatsApp on. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog labelledBy="wa-t" width={420} onClose={step === 1 ? () => onDone(saved) : onClose} tp="tp-set">
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
        <button type="button" className="ibtn ghost" aria-label="Close" onClick={step === 1 ? () => onDone(saved) : onClose}>
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
            <Button disabled={busy || !valid || !consent} onClick={() => void submit()}>
              Turn on
            </Button>
          </>
        ) : (
          <Button onClick={() => onDone(saved)}>Done</Button>
        )}
      </div>
    </Dialog>
  );
}
