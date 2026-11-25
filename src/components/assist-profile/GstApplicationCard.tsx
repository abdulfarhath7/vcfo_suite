'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, FileSearch, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/spectrum-chip';
import { useAskOptional } from '@/components/ask/ask-context';
import { useGstRegistration, useGstSourcing } from '@/hooks/use-gst-registration';
import { gstButtonMessage } from '@/lib/ask/gst/intent';
import type { GstSource } from '@/lib/registrations/gst-profile';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { ConfirmClientValues } from './ConfirmClientValues';
import { StartOnGstPortal } from './StartOnGstPortal';

const SOURCE_LABEL: Record<GstSource, string> = {
  tool: 'In the tool',
  sharepoint: 'From the papers (SharePoint)',
  zoho: 'From Zoho',
  client: 'From the client',
  portal: 'Looked up on the portal',
};

/**
 * GST application (REG-01) readiness on the GST registration page and step, staff only. It reads
 * what the tool holds for the application, lists what is missing and where it comes from, and
 * offers the next step of the chain: read the papers from SharePoint into the tool, ask the client
 * (a draft request list), then "Start on GST portal". The SharePoint fetch and the request go
 * through Ask VCFO when it is on the page, so the review card appears in the chat; otherwise the
 * page starts them itself.
 */
export function GstApplicationCard({ engagementId, className }: { engagementId: string; className?: string }) {
  const query = useGstRegistration(engagementId);
  const sourcing = useGstSourcing(engagementId);
  const ask = useAskOptional();
  const [open, setOpen] = useState(false);
  const data = query.data;

  const run = async (kind: 'fetch_sharepoint' | 'ask_client') => {
    if (!data) return;
    if (ask?.shell && ask.shell !== 'client') {
      ask.setOpen(true);
      await ask.ask({ message: gstButtonMessage(kind, data.view.companyName) });
      return;
    }
    try {
      const out = await sourcing.mutateAsync(kind);
      toastSuccess(kind === 'fetch_sharepoint' ? 'Reading SharePoint' : 'Request list drafted', out.message);
    } catch (error) {
      toastError('Could not start that', errorMessage(error));
    }
  };

  return (
    <section aria-label="GST application" className={cn('surface grid gap-2.5 px-3.5 py-3 text-[13px]', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-ink">GST application (REG-01)</p>
        {data ? <Tag tone={data.view.ready ? 'ok' : 'warn'}>{data.view.ready ? 'Ready to file' : `${data.view.gapCount} missing`}</Tag> : null}
        {data && !data.view.ready ? (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-text hover:underline"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide what is missing' : 'Show what is missing'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        ) : null}
      </div>
      {query.isError ? <p className="text-ink-muted">{errorMessage(query.error, 'The GST application could not be loaded.')}</p> : null}
      {!data && !query.isError ? (
        <p className="text-ink-muted" aria-busy>
          Checking what the tool holds…
        </p>
      ) : null}
      {data ? (
        <>
          <p className="text-ink-2">
            {data.view.ready
              ? 'Every value REG-01 needs is in the tool. VCFO Assist fills the portal from it; you sign in, type the OTPs, authenticate Aadhaar and submit.'
              : 'Values go into the tool first, then onto the portal. Read the papers from SharePoint, or ask the client for the rest.'}
          </p>
          {open && data.missing.some((m) => m.required) ? (
            <ul className="grid gap-1" aria-label="Missing for REG-01">
              {data.missing
                .filter((m) => m.required)
                .map((m) => (
                  <li key={m.key} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-ink">{m.label}</span>
                    <span className="text-[12px] text-ink-muted">
                      {SOURCE_LABEL[m.source]} · {m.where}
                    </span>
                  </li>
                ))}
            </ul>
          ) : null}
          <ConfirmClientValues engagementId={data.engagementId} items={data.view.confirm ?? []} />
          <div className="flex flex-wrap items-start gap-2">
            {data.view.actions.includes('fetch_sharepoint') ? (
              <Button type="button" size="sm" variant="outline" disabled={sourcing.isPending} onClick={() => void run('fetch_sharepoint')}>
                <FileSearch aria-hidden />
                Fetch from SharePoint
              </Button>
            ) : null}
            {data.view.actions.includes('ask_client') ? (
              <Button type="button" size="sm" variant="outline" disabled={sourcing.isPending} onClick={() => void run('ask_client')}>
                <Send aria-hidden />
                Ask the client
              </Button>
            ) : null}
            <StartOnGstPortal engagementId={data.engagementId} ready={data.view.ready} />
          </div>
          {sourcing.data?.href ? (
            <Link href={sourcing.data.href} className="text-[12.5px] font-medium text-brand-text hover:underline">
              Open the request list
            </Link>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
