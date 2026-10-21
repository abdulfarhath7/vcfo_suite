'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookMarked, Download } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { EmptyStateIllustrated } from '@/components/noir';
import { useAskOptional } from '@/components/ask/ask-context';
import { StatusBriefButton } from '@/components/ask/StatusBriefButton';
import { categoryLabel } from '@/lib/ask/categories';
import { fetchLibrary } from '@/hooks/ask/ask-api';
import { cn } from '@/lib/utils';

const VISUAL_LABEL: Record<string, string> = {
  flow: 'Flow',
  steps: 'Steps',
  compare: 'Comparison',
  timeline: 'Timeline',
  keyFacts: 'Key facts',
  nextStep: 'Next step',
};

/** Client Library (§8.3): saved explanations, private to this user. */
export default function ClientLibrary() {
  const ask = useAskOptional();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['ask', 'library'], queryFn: fetchLibrary });
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const shown = items.filter(
    (i) =>
      (!category || i.category === category) &&
      (!search.trim() || `${i.title} ${i.answer.line}`.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <PageTransition>
      <SEO title="Library" description="Explanations you saved from Ask VCFO" path="/app/client/library" />
      <PageHeader
        title="Library"
        subtitle="Explanations you saved from Ask VCFO."
        icon={BookMarked}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBriefButton />
            {shown.length > 0 ? (
            <a
              href={`/api/ask/library/export?${new URLSearchParams({ ids: shown.map((i) => i.id).join(',') })}`}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-line px-3 text-[13px] font-medium text-ink hover:bg-surface-sunken"
            >
              <Download className="h-4 w-4" aria-hidden /> Download PDF brief
              </a>
            ) : null}
          </div>
        }
      />

      {query.isLoading && <p className="py-6 text-[13px] text-ink-muted">Loading…</p>}
      {query.isError && (
        <p role="alert" className="py-6 text-[13px] text-danger">
          Could not load your library. Please refresh the page.
        </p>
      )}

      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyStateIllustrated
          title="Save explanations you want to keep"
          description="Ask VCFO anything and tap Save to library."
          actionLabel={ask?.enabled ? 'Ask VCFO' : undefined}
          onAction={ask?.enabled ? () => ask.setOpen(true) : undefined}
          icon={BookMarked}
        />
      )}

      {items.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="library-search" className="sr-only">
              Search your library
            </label>
            <input
              id="library-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your library"
              className="min-h-[40px] w-full max-w-xs rounded-[var(--radius-md)] border border-input bg-surface-raised px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40"
            />
            <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
              {[null, ...categories].map((c) => (
                <button
                  key={c ?? 'all'}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    'min-h-[36px] rounded-sm border px-3 text-[12.5px]',
                    category === c ? 'border-ink/30 bg-surface-sunken font-medium text-ink' : 'border-line text-ink-muted hover:text-ink',
                  )}
                >
                  {c ? categoryLabel(c) : 'All'}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Nothing matches that search.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((item) => (
                <li key={item.id} className="flex flex-col rounded-[var(--radius)] border border-line bg-surface-raised p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-sm bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted">{categoryLabel(item.category)}</span>
                    {item.updated && (
                      <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">Updated</span>
                    )}
                    {item.answer.visual && VISUAL_LABEL[item.answer.visual.type] && (
                      <span className="ml-auto text-[11px] text-ink-muted">{VISUAL_LABEL[item.answer.visual.type]}</span>
                    )}
                  </div>
                  <h2 className="mt-2 text-[15px] font-semibold text-ink">{item.title}</h2>
                  <p className="mt-1 line-clamp-2 flex-1 text-[13px] text-ink-muted">{item.answer.line}</p>
                  <Link
                    href={`/app/client/library/${item.id}`}
                    className="mt-3 inline-flex min-h-[40px] items-center self-start rounded-[var(--radius-md)] border border-line px-3 text-[13px] font-medium text-ink hover:bg-surface-sunken"
                  >
                    Open<span className="sr-only"> {item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageTransition>
  );
}
