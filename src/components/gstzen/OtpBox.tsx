'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GSTZEN_QUERY_KEY, postOtp } from '@/hooks/use-gstzen';
import { OTP_RE, type AgentOtpRequestView } from '@/lib/gstzen/types';
import { cn } from '@/lib/utils';

/**
 * The OTP box of a "Your turn" request (MASTER-PLAN screens 7 and 8). The person types the six digits
 * the GST portal sent; Send posts them once, straight through to GSTZen, and clears the box whatever
 * the answer. The OTP is held only in this input while it is typed: never in a cache, the URL or
 * storage. The request closes after ten minutes.
 */
export function OtpBox({
  who,
  request,
  onDone,
  className,
}: {
  who: 'staff' | 'client';
  request: AgentOtpRequestView;
  onDone?: (r: { purpose: 'gstn_consent' | 'evc'; arn?: string }) => void;
  className?: string;
}) {
  const id = useId();
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = useMinutesLeft(request.expiresAt);
  const expired = left <= 0;

  const submit = async () => {
    const value = otp.trim();
    if (!OTP_RE.test(value) || busy || expired) return;
    setBusy(true);
    setError(null);
    setOtp('');
    try {
      const out = await postOtp(who, request.id, value);
      onDone?.(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The OTP could not be sent. Try again.');
      ref.current?.focus();
    } finally {
      setBusy(false);
      void qc.invalidateQueries({ queryKey: [GSTZEN_QUERY_KEY] });
    }
  };

  return (
    <form
      className={cn('grid gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={id} className="text-[12.5px] font-medium text-ink-2">
        {request.purpose === 'evc' ? 'EVC OTP' : 'Consent OTP'}
        {request.sentTo ? <span className="font-normal text-ink-muted"> · sent to {request.sentTo}</span> : null}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={ref}
          id={id}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="6 digits"
          aria-describedby={`${id}-note`}
          disabled={busy || expired}
          className="h-control-md w-[9.5rem] font-mono text-[16px] tracking-[0.35em] placeholder:font-sans placeholder:text-[14px] placeholder:tracking-normal"
        />
        <Button type="submit" size="default" disabled={busy || expired || !OTP_RE.test(otp)}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {busy ? 'Sending' : 'Send'}
        </Button>
      </div>
      <p id={`${id}-note`} className="text-[12px] text-ink-muted">
        {expired ? 'This request expired. Ask for a new OTP.' : `Goes straight to the GST portal through the GSP. SBC never sees or keeps this OTP. Closes in ${left} min.`}
      </p>
      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function useMinutesLeft(expiresAt: string): number {
  const calc = () => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60_000));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const t = setInterval(() => setLeft(calc()), 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);
  return left;
}
