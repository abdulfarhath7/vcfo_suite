'use client';

/** "Board resolution · Ready" header button (`.hbtn` + `.rd`, FINAL heroLanding) → the board page. */
import { clientBoardResolutionPath } from '@/lib/project-step-path';
import type { IncorporationBoardResolution } from '@/lib/client-portal/incorporation-types';
import { usePortal } from '../../PortalProvider';
import { Ic, fmt, istDay } from './ui';

export function BoardResolutionLink({ br }: { br: IncorporationBoardResolution | null }) {
  const { go } = usePortal();
  if (!br || br.status !== 'finalized' || !br.hasDocx) return null;
  const signed = br.signedUploadedAt ? istDay(br.signedUploadedAt) : undefined;
  const tip = signed ? `Board resolution · signed copy received ${fmt(signed)}` : 'Board resolution · ready to sign';
  return (
    <a
      href={clientBoardResolutionPath()}
      className="hbtn"
      aria-label={signed ? 'Board resolution · ready' : 'Board resolution · ready to sign'}
      data-tt={tip}
      data-notip=""
      onClick={(e) => {
        e.preventDefault();
        go(clientBoardResolutionPath());
      }}
    >
      <Ic n="file-text" />
      <span className="lt">Board resolution</span>
      <span className="rd">
        <Ic n="check" />
        Ready
      </span>
    </a>
  );
}
