'use client';

/** "Board resolution · Ready" head button on the Incorporation landing: opens the board page. Renders inside a `.cp-tw` island. */
import { FileText } from 'lucide-react';
import { clientBoardResolutionPath } from '@/lib/projects/project-step-path';
import type { IncorporationBoardResolution } from '@/lib/client-portal/incorporation-types';
import { Chip } from '@/components/ui/spectrum-chip';
import { fmt, istDay } from './ui';
import { useGo } from './spectrum';

export function BoardResolutionLink({ br }: { br: IncorporationBoardResolution | null }) {
  const go = useGo();
  if (!br || br.status !== 'finalized' || !br.hasDocx) return null;
  const signed = br.signedUploadedAt ? istDay(br.signedUploadedAt) : undefined;
  const tip = signed ? `Board resolution · signed copy received ${fmt(signed)}` : 'Board resolution · ready to sign';
  const href = clientBoardResolutionPath();
  return (
    <a
      href={href}
      onClick={go(href)}
      aria-label={signed ? 'Board resolution · ready' : 'Board resolution · ready to sign'}
      data-tt={tip}
      data-notip=""
      className="inline-flex h-control-md items-center gap-[7px] rounded-md border-1.5 border-line-strong bg-surface-raised px-3 text-[14px] font-medium text-ink hover:bg-surface-sunken"
    >
      <FileText size={16} strokeWidth={1.6} aria-hidden />
      <span className="text-ink">Board resolution</span>
      <Chip tone={signed ? 'ok' : 'teal'} className="min-w-0">
        {signed ? 'Done' : 'Waiting'}
      </Chip>
    </a>
  );
}
