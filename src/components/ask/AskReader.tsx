'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download } from 'lucide-react';
import type { AnswerDepth, AnswerEnvelope } from '@/data/ask/schema';
import { saveToLibrary } from '@/hooks/ask/ask-api';
import { categoryLabel } from '@/lib/ask/categories';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';
import { TrustBadge } from './TrustBadge';
import { VisualRenderer } from './visuals/VisualRenderer';


const secondary =
  'inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-line px-3 text-[13px] font-medium text-ink hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40 disabled:opacity-50';

/**
 * Full-page explainer (D3), shared by /learn/[slug] and /library/[id]:
 * category, H1, trust badge, depth switch, large visual, why, sources,
 * save, ask a follow-up.
 */
export function AskReader({
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
  const ask = useAskOptional();
  const [saved, setSaved] = useState(savedInitially);
  const [error, setError] = useState<string | null>(null);
  const firmName = ask?.firmName ?? 'SBC';

  return (
    <article className="mx-auto max-w-[760px] space-y-5 pb-10">
      <Link href={backHref} className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {backLabel}
      </Link>
      <div className="space-y-2">
        <span className="inline-block rounded-sm bg-surface-sunken px-2.5 py-0.5 text-[11.5px] font-medium text-ink-muted">
          {categoryLabel(category)}
        </span>
        <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <TrustBadge answer={answer} firmName={firmName} />
          {notice && <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">{notice}</span>}
        </div>
      </div>

      {onDepth && (
        <div role="group" aria-label="Depth" className="inline-flex rounded-[var(--radius-md)] border border-line p-0.5">
          {(['simple', 'normal', 'detail'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={answer.depth === d}
              disabled={depthBusy}
              onClick={() => onDepth(d)}
              className={cn(
                'min-h-[36px] rounded-[calc(var(--radius-md)-2px)] px-3 text-[12.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40',
                answer.depth === d ? 'bg-surface-sunken font-medium text-ink' : 'text-ink-muted hover:text-ink',
              )}
            >
              {d === 'simple' ? 'Simpler' : d === 'normal' ? 'Normal' : 'More detail'}
            </button>
          ))}
        </div>
      )}

      <p className="text-[16px] leading-relaxed text-ink">{answer.line}</p>
      {answer.visual && (
        <div className="rounded-[var(--radius)] border border-line bg-surface-raised p-4">
          <VisualRenderer visual={answer.visual} />
        </div>
      )}
      {answer.why && (
        <section>
          <h2 className="text-[14px] font-semibold text-ink">Why it matters to you</h2>
          <p className="mt-1 text-[14px] text-ink-muted">{answer.why}</p>
        </section>
      )}
      {answer.citations.length > 0 && (
        <section>
          <h2 className="text-[12.5px] font-semibold text-ink">Sources</h2>
          <ul className="mt-1 space-y-0.5 text-[12.5px] text-ink-muted">
            {answer.citations.map((c) => (
              <li key={c.id}>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
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

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {engagementId && !ask?.preview && (topicSlug || savedInitially) && (
          <button
            type="button"
            className={cn(secondary, saved && 'text-positive')}
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
        {ask?.enabled && (
          <button
            type="button"
            className={secondary}
            onClick={() => {
              ask.setOpen(true);
              if (topicSlug) void ask.showTopic(topicSlug, answer.depth, `Tell me more about ${title}`);
            }}
          >
            Ask a follow-up
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      )}
    </article>
  );
}
