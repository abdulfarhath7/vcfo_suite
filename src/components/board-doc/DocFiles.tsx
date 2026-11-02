'use client';

import type { ReactNode } from 'react';
import { Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileBadge } from '@/components/ui/file-badge';
import { cn } from '@/lib/utils';
import { docDay } from './format';
import type { DocFile } from './types';

/**
 * C7: the files of a document (the Word draft and the signed copy). The client never sees the
 * internal file name (P5); staff pass `showInternalName`. `footer` holds the page's upload or
 * replace drop zone.
 */
export function DocFiles({
  files,
  showInternalName = false,
  onOpen,
  onDownload,
  footer,
  className,
}: {
  files: DocFile[];
  showInternalName?: boolean;
  onOpen?: (f: DocFile) => void;
  onDownload?: (f: DocFile) => void;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {files.length ? (
        <ul className="m-0 list-none divide-y divide-line-soft p-0">
          {files.map((f) => {
            const rest = [showInternalName ? f.name : undefined, f.by, docDay(f.at)].filter(Boolean).join(' · ');
            return (
              <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                <FileBadge type={f.type} name={f.name ?? f.title} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13px] font-medium text-ink">{f.title}</b>
                  <span className="block truncate text-[12px] text-ink-muted">
                    {f.status ? <span className="text-positive">{f.status}</span> : null}
                    {f.status && rest ? ' · ' : null}
                    {rest}
                  </span>
                </span>
                {onOpen ? (
                  <Button size="iconSm" variant="quiet" aria-label={`Preview ${f.title}`} onClick={() => onOpen(f)}>
                    <Eye strokeWidth={1.6} aria-hidden />
                  </Button>
                ) : null}
                {onDownload ? (
                  <Button size="iconSm" variant="quiet" aria-label={`Download ${f.title}`} onClick={() => onDownload(f)}>
                    <Download strokeWidth={1.6} aria-hidden />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {footer ? <div className={cn('px-4 py-3', files.length ? 'border-t border-line-soft' : '')}>{footer}</div> : null}
    </div>
  );
}
