import { cn } from '@/lib/utils';
import { docDay } from './format';
import type { AuditLine } from './types';

/** W6: the audit trail of a document, newest first: "14 Oct · Bharath · Released". */
export function AuditLines({ lines, empty = 'No activity yet', className }: { lines: AuditLine[]; empty?: string; className?: string }) {
  const sorted = [...lines].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!sorted.length) return <p className={cn('m-0 px-4 py-3 text-[13px] text-ink-muted', className)}>{empty}</p>;
  return (
    <ol className={cn('m-0 list-none divide-y divide-line-soft p-0', className)} aria-label="Activity">
      {sorted.map((l) => (
        <li key={l.id} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 px-4 py-2 text-[13px]">
          <time dateTime={l.at} className="text-ink-muted">
            {docDay(l.at)}
          </time>
          <span className="min-w-0 break-words text-ink">
            <b className="font-medium">{l.who}</b>
            <span className="text-ink-muted"> · </span>
            {l.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
