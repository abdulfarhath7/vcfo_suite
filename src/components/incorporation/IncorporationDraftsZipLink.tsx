import { Archive } from 'lucide-react';

import { buildIncorpDraftsZipUrl } from '@/lib/incorporation-docs/preview-url';
import { cn } from '@/lib/utils';

/** "Download all (.zip)" — same look as the document pack's zip link. */
export function IncorporationDraftsZipLink({
  engagementId,
  className,
}: {
  engagementId: string;
  className?: string;
}) {
  return (
    <a
      href={buildIncorpDraftsZipUrl(engagementId)}
      download
      className={cn(
        'inline-flex h-8 items-center rounded-md border border-line bg-surface-raised px-3 text-[12px] font-medium text-brand hover:border-brand/35 hover:bg-brand-soft',
        className,
      )}
    >
      <Archive className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      Download all (.zip)
    </a>
  );
}
