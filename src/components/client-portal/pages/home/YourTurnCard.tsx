'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { OtpBox } from '@/components/gstzen/OtpBox';
import { useClientOtpRequests } from '@/hooks/use-gstzen';
import { SCard } from '../incorporation/spectrum';

/**
 * CLIENT HOME › ACTION NEEDED (MASTER-PLAN screen 8): the OTPs the GST portal sent the client while
 * SBC files a GST return through the GSP (the consent OTP, or the EVC OTP to the authorised
 * signatory). The client types the OTP here; it goes straight to the GST portal through the GSP and
 * SBC never sees or keeps it. Each request closes after ten minutes. Hidden when nothing is waiting.
 */
export function YourTurnCard({ className }: { className?: string }) {
  const q = useClientOtpRequests();
  const [done, setDone] = useState<string | null>(null);
  const rows = q.data ?? [];
  if (!rows.length && !done) return null;
  return (
    <SCard title="Action needed" meta={rows.length || undefined} className={className}>
      <div className="grid gap-4">
        {done ? (
          <p role="status" className="flex items-center gap-2 text-[13.5px] text-positive">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {done}
          </p>
        ) : null}
        {rows.map((r) => (
          <div key={r.id} className="grid gap-2.5">
            <p className="text-[14px] text-ink">{r.title}</p>
            <OtpBox
              who="client"
              request={r}
              onDone={(out) => setDone(out.purpose === 'evc' ? `Filed. ARN ${out.arn ?? ''}`.trim() : 'Thank you. SBC can now read your GST return on the portal.')}
            />
          </div>
        ))}
      </div>
    </SCard>
  );
}
