'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { startGstOnPortal } from './start-gst';

/**
 * "Start on GST portal" — opens the VCFO Assist GST REG-01 flow for this engagement, exactly like
 * the SPICe+ one-button Start: this tab is marked with the form and the engagement, and the
 * extension's side panel opens the portal's New Registration page in its own tab and fills it from
 * the tool. Suite opens no portal tab; without the extension it shows how to install it.
 * The person signs in, types the OTPs and the captcha, authenticates Aadhaar and submits with DSC
 * or EVC (SBC-STD-AI-02). Staff only; the caller decides where it shows.
 */
export function StartOnGstPortal({
  engagementId,
  ready,
  size = 'sm',
  className,
}: {
  engagementId: string;
  /** False shows a warning that the extension leaves the missing fields blank. */
  ready: boolean;
  size?: 'sm' | 'default';
  className?: string;
}) {
  const [started, setStarted] = useState<{ installed: boolean } | null>(null);
  return (
    <div className={cn('grid gap-2', className)}>
      <Button type="button" size={size} variant={ready ? 'default' : 'outline'} onClick={() => setStarted(startGstOnPortal(engagementId))}>
        <ExternalLink aria-hidden />
        Start on GST portal
      </Button>
      {started ? (
        <div role="status" className="rounded-md border border-line bg-surface-raised px-3 py-2 text-[12.5px] text-ink-2">
          {started.installed ? (
            <p>
              Open the VCFO Assist side panel and press Start for GST REG-01; it opens the GST portal in its own tab. You sign in, type the OTPs, do
              the Aadhaar authentication and submit; the ARN comes back to the tracker here.
            </p>
          ) : (
            <>
              <p className="font-medium text-ink">VCFO Assist is not installed in this browser.</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>In Chrome open chrome://extensions and turn on Developer mode, or ask the firm to push the managed install.</li>
                <li>Load unpacked: the vcfo_assist folder itself (it has no build step).</li>
                <li>Keep this tab open, open the extension&apos;s side panel and press Start for GST REG-01; it opens the GST portal itself.</li>
              </ol>
            </>
          )}
          {!ready ? <p className="mt-1 text-warning">Some values are still missing in the tool; the extension leaves those fields for you to type.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
