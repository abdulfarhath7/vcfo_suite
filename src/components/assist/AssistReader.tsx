'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download } from 'lucide-react';
import type { AnswerDepth, AnswerEnvelope } from '@/data/assist/schema';
import { saveToLibrary } from '@/hooks/assist/assist-api';
import { categoryLabel } from '@/lib/assist/categories';
import { cn } from '@/lib/utils';
import { useAssistOptional } from './assist-context';
import { TrustBadge } from './TrustBadge';
import { VisualRenderer } from './visuals/VisualRenderer';


const secondary =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3 text-[13px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50';

/**
 * Full-page explainer (D3), shared by /learn/[slug] and /library/[id]:
 * category, H1, trust badge, depth switch, large visual, why, sources,
 * save, ask a follow-up.
 */
export function AssistReader({
  title,
  category,
  answer,
  backHref,
  backLabel,
  notice,
  onDepth,
  depthBusy,
  topicSlug,
  savedInitially = false,
  exportHref,
  engagementId,
}: {
  title: string;
  category: string;
  answer: AnswerEnvelope;
  backHref: string;
  backLabel: string;
  notice?: string | null;
  onDepth?: (depth: AnswerDepth) => void;
  depthBusy?: boolean;
  topicSlug?: string | null;
  savedInitially?: boolean;
  exportHref?: string;
  engagementId: string | null;
}) {
  const assist = useAssistOptional();
  const [saved, setSaved] = useState(savedInitially);
  const [error, setError] = useState<string | null>(null);
  const firmName = assist?.firmName ?? 'SBC';

  return (
    <article className="mx-auto max-w-[760px] space-y-5 pb-10">
      <Link href={backHref} className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {backLabel}
      </Link>
      <div className="space-y-2">
        <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11.5px] font-medium text-muted-foreground">
          {categoryLabel(category)}
        </span>
        <h1 className="font-serif text-[28px] font-semibold leading-tight text-foreground">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <TrustBadge answer={answer} firmName={firmName} />
          {notice && <span className="rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-medium text-warning-text">{notice}</span>}
        </div>
      </div>

      {onDepth && (
        <div role="group" aria-label="Depth" className="inline-flex rounded-[var(--radius-md)] border border-border p-0.5">
          {(['simple', 'normal', 'detail'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={answer.depth === d}
              disabled={depthBusy}
              onClick={() => onDepth(d)}
              className={cn(
                'min-h-[36px] rounded-[calc(var(--radius-md)-2px)] px-3 text-[12.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                answer.depth === d ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {d === 'simple' ? 'Simpler' : d === 'normal' ? 'Normal' : 'More detail'}
            </button>
          ))}
        </div>
      )}

      <p className="text-[16px] leading-relaxed text-foreground">{answer.line}</p>
      {answer.visual && (
        <div className="rounded-[var(--radius)] border border-border bg-panel p-4">
          <VisualRenderer visual={answer.visual} />
        </div>
      )}
      {answer.why && (
        <section>
          <h2 className="text-[14px] font-semibold text-foreground">Why it matters to you</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">{answer.why}</p>
        </section>
      )}
      {answer.citations.length > 0 && (
        <section>
          <h2 className="text-[12.5px] font-semibold text-foreground">Sources</h2>
          <ul className="mt-1 space-y-0.5 text-[12.5px] text-muted-foreground">
            {answer.citations.map((c) => (
              <li key={c.id}>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {c.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  c.label
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {engagementId && !assist?.preview && (topicSlug || savedInitially) && (
          <button
            type="button"
            className={cn(secondary, saved && 'text-success-text')}
            disabled={saved}
            onClick={async () => {
              if (!topicSlug) return;
              setError(null);
              try {
                await saveToLibrary({ engagementId, topicSlug, answer });
                setSaved(true);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" aria-hidden /> Saved to library
              </>
            ) : (
              'Save to library'
            )}
          </button>
        )}
        {exportHref && (
          <a href={exportHref} className={secondary}>
            <Download className="h-4 w-4" aria-hidden /> Download PDF brief
          </a>
        )}
        {assist?.enabled && (
          <button
            type="button"
            className={secondary}
            onClick={() => {
              assist.setOpen(true);
              if (topicSlug) void assist.showTopic(topicSlug, answer.depth, `Tell me more about ${title}`);
            }}
          >
            Ask a follow-up
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[12.5px] text-danger-text">
          {error}
        </p>
      )}
    </article>
  );
}
