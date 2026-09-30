'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { AskReader } from '@/components/ask/AskReader';
import { useAskOptional } from '@/components/ask/ask-context';
import { deleteLibraryItem, fetchLibraryItem } from '@/hooks/ask/ask-api';

/** A saved explanation in the reader (§8.4); an updated topic opens at its current version. */
export default function ClientLibraryItem() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const queryClient = useQueryClient();
  const ask = useAskOptional();
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['ask', 'library', id], queryFn: () => fetchLibraryItem(id), enabled: Boolean(id) });

  if (query.isLoading) return <p className="p-6 text-[13px] text-muted-foreground">Loading…</p>;
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="p-6 text-[13px] text-danger-text">
        This item is not in your library.
      </p>
    );
  }
  const { item, notice } = query.data;
  return (
    <PageTransition>
      <SEO title={item.title} description="Saved explanation" path={`/app/client/library/${id}`} />
      <AskReader
        title={item.title}
        category={item.category}
        answer={item.answer}
        backHref="/app/client/library"
        backLabel="Library"
        notice={notice}
        topicSlug={item.topicSlug}
        savedInitially
        exportHref={`/api/ask/library/${encodeURIComponent(id)}/export`}
        engagementId={ask?.engagementId ?? null}
      />
      <div className="mx-auto max-w-[760px]">
        <button
          type="button"
          onClick={async () => {
            setError(null);
            try {
              await deleteLibraryItem(id);
              await queryClient.invalidateQueries({ queryKey: ['ask', 'library'] });
              router.push('/app/client/library');
            } catch (err) {
              setError((err as Error).message);
            }
          }}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-[13px] text-muted-foreground hover:bg-muted hover:text-danger-text"
        >
          <Trash2 className="h-4 w-4" aria-hidden /> Remove from library
        </button>
        {error && (
          <p role="alert" className="text-[12.5px] text-danger-text">
            {error}
          </p>
        )}
      </div>
    </PageTransition>
  );
}
