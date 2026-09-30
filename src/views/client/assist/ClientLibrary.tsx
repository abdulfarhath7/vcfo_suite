'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BookMarked, Download } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { EmptyStateIllustrated } from '@/components/noir';
import { useAssistOptional } from '@/components/assist/assist-context';
import { categoryLabel } from '@/lib/assist/categories';
import { fetchLibrary } from '@/hooks/assist/assist-api';
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
  const assist = useAssistOptional();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['assist', 'library'], queryFn: fetchLibrary });
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const shown = items.filter(
    (i) =>
      (!category || i.category === category) &&
      (!search.trim() || `${i.title} ${i.answer.line}`.toLowerCase().includes(search.trim().toLowerCase())),
  );

  return (
    <PageTransition>
      <SEO title="Library" description="Explanations you saved from Assist" path="/app/client/library" />
      <PageHeader
        title="Library"
        subtitle="Explanations you saved from Assist."
        icon={BookMarked}
        actions={
          shown.length > 0 ? (
            <a
              href={`/api/assist/library/export?${new URLSearchParams({ ids: shown.map((i) => i.id).join(',') })}`}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3 text-[13px] font-medium text-foreground hover:bg-muted"
            >
              <Download className="h-4 w-4" aria-hidden /> Download PDF brief
            </a>
          ) : undefined
        }
      />

      {query.isLoading && <p className="py-6 text-[13px] text-muted-foreground">Loading…</p>}
      {query.isError && (
        <p role="alert" className="py-6 text-[13px] text-danger-text">
          Could not load your library. Please refresh the page.
        </p>
      )}

      {!query.isLoading && !query.isError && items.length === 0 && (
        <EmptyStateIllustrated
          title="Save explanations you want to keep"
          description="Ask Assist anything and tap Save to library."
          actionLabel={assist?.enabled ? 'Ask Assist' : undefined}
          onAction={assist?.enabled ? () => assist.setOpen(true) : undefined}
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
              className="min-h-[40px] w-full max-w-xs rounded-[var(--radius-md)] border border-input bg-background px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5">
              {[null, ...categories].map((c) => (
                <button
                  key={c ?? 'all'}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    'min-h-[36px] rounded-full border px-3 text-[12.5px]',
                    category === c ? 'border-foreground/30 bg-muted font-medium text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {c ? categoryLabel(c) : 'All'}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nothing matches that search.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((item) => (
                <li key={item.id} className="flex flex-col rounded-[var(--radius)] border border-border bg-panel p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{categoryLabel(item.category)}</span>
                    {item.updated && (
                      <span className="rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-medium text-warning-text">Updated</span>
                    )}
                    {item.answer.visual && VISUAL_LABEL[item.answer.visual.type] && (
                      <span className="ml-auto text-[11px] text-muted-foreground">{VISUAL_LABEL[item.answer.visual.type]}</span>
                    )}
                  </div>
                  <h2 className="mt-2 text-[15px] font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-1 line-clamp-2 flex-1 text-[13px] text-muted-foreground">{item.answer.line}</p>
                  <Link
                    href={`/app/client/library/${item.id}`}
                    className="mt-3 inline-flex min-h-[40px] items-center self-start rounded-[var(--radius-md)] border border-border px-3 text-[13px] font-medium text-foreground hover:bg-muted"
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
