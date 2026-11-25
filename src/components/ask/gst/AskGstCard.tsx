'use client';

import Link from 'next/link';
import { FileSearch, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/spectrum-chip';
import { ConfirmClientValues } from '@/components/assist-profile/ConfirmClientValues';
import { StartOnGstPortal } from '@/components/assist-profile/StartOnGstPortal';
import { gstButtonMessage } from '@/lib/ask/gst/intent';
import type { GstCardData } from '@/lib/ask/gst/card';
import type { GstSource } from '@/lib/registrations/gst-profile';
import { useAskOptional } from '../ask-context';

const SOURCE_WORD: Record<GstSource, string> = {
  tool: 'Tool',
  sharepoint: 'SharePoint',
  zoho: 'Zoho',
  client: 'Client',
  portal: 'Portal',
};

/**
 * The GST registration card under an Ask VCFO answer ("register Kestrel for GST"): ready, or what
 * is missing and where it comes from, with the next step of the chain. "Fetch from SharePoint" and
 * "Ask the client" send the chat message the GST intent reads, so the drop's review card and the
 * request list arrive in this chat; "Start on GST portal" opens the VCFO Assist flow exactly as on
 * the step page. Staff only (the thread shows it outside the client shell).
 */
export function AskGstCard({ gst }: { gst: GstCardData }) {
  const ask = useAskOptional();
  const send = (kind: 'fetch_sharepoint' | 'ask_client') => void ask?.ask({ message: gstButtonMessage(kind, gst.companyName) });
  return (
    <section aria-label={`GST registration of ${gst.companyName}`} className="mt-2 grid gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">GST REG-01 · {gst.companyName}</span>
        <Tag tone={gst.ready ? 'ok' : 'warn'}>{gst.ready ? 'Ready' : `${gst.gapCount} missing`}</Tag>
      </div>
      {gst.gaps.length ? (
        <ul className="grid gap-0.5" aria-label="Missing">
          {gst.gaps.map((g) => (
            <li key={g.key} className="flex items-baseline gap-2">
              <span className="w-[74px] flex-none text-[11.5px] text-ink-muted">{SOURCE_WORD[g.source]}</span>
              <span className="min-w-0 text-ink">{g.label}</span>
            </li>
          ))}
          {gst.gapCount > gst.gaps.length ? <li className="text-ink-muted">and {gst.gapCount - gst.gaps.length} more on the GST registration page</li> : null}
        </ul>
      ) : null}
      {gst.actions.includes('confirm_client') ? <ConfirmClientValues engagementId={gst.engagementId} items={gst.confirm ?? []} /> : null}
      <div className="flex flex-wrap items-start gap-2">
        {gst.actions.includes('fetch_sharepoint') ? (
          <Button type="button" size="sm" variant="outline" disabled={!ask || ask.busy} onClick={() => send('fetch_sharepoint')}>
            <FileSearch aria-hidden />
            Fetch from SharePoint
          </Button>
        ) : null}
        {gst.actions.includes('ask_client') ? (
          <Button type="button" size="sm" variant="outline" disabled={!ask || ask.busy} onClick={() => send('ask_client')}>
            <Send aria-hidden />
            Ask the client
          </Button>
        ) : null}
        {gst.actions.includes('start_portal') ? <StartOnGstPortal engagementId={gst.engagementId} ready={gst.ready} /> : null}
        {gst.requestHref ? (
          <Link href={gst.requestHref} className="self-center font-medium text-brand-text hover:underline">
            Open the request list
          </Link>
        ) : null}
      </div>
    </section>
  );
}
