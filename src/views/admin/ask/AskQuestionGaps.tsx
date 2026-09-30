'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileDown, MessageCircleQuestion } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { draftTopicFor, type GapGroup } from '@/lib/ask/question-gaps';

type GapsResponse = { days: number; total: number; groups: GapGroup[]; showsCompanies: boolean };

/** Hand the reviewer a draft topic file to edit and add by pull request. */
function downloadDraftTopic(question: string) {
  const topic = draftTopicFor(question);
  const blob = new Blob([`${JSON.stringify(topic, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(topic.slug)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** A1: client questions with no reviewed answer, grouped, without client identity. */
export default function AskQuestionGaps() {
  const query = useQuery({
    queryKey: ['ask', 'gaps'],
    queryFn: async (): Promise<GapsResponse | null> => {
      const res = await fetch('/api/ask/admin/gaps');
      if (res.status === 404) return null;
      const body = (await res.json().catch(() => null)) as (GapsResponse & { error?: string }) | null;
      if (!res.ok || !body) throw new Error(body?.error || 'Could not load question gaps');
      return body;
    },
  });
  const data = query.data;

  return (
    <PageTransition>
      <SEO title="Ask VCFO question gaps" description="Client questions with no reviewed answer yet" path="/app/admin/ask-vcfo/gaps" />
      <PageHeader
        title="Question gaps"
        subtitle="What clients asked Ask VCFO that had no reviewed answer. Write a topic for the common ones."
        icon={MessageCircleQuestion}
        actions={
          <Link
            href="/app/admin/ask-vcfo/sources"
            className="inline-flex min-h-[40px] items-center rounded-[var(--radius-md)] border border-border px-3 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            Sources
          </Link>
        }
      />

      {query.isLoading && <p className="mt-4 text-[13px] text-muted-foreground">Loading…</p>}
      {query.isError && (
        <p role="alert" className="mt-4 text-[13px] text-danger-text">
          Could not load question gaps. Please refresh the page.
        </p>
      )}
      {query.isSuccess && data === null && (
        <p className="mt-4 text-[13px] text-muted-foreground">
          Question gaps are turned off. Your administrator can turn the feature on.
        </p>
      )}
      {data && (
        <div className="mt-4 space-y-3">
          <p className="text-[12.5px] text-muted-foreground">
            Last {data.days} days · {data.total} {data.total === 1 ? 'question' : 'questions'} without a reviewed answer.
            {data.showsCompanies ? '' : ' Client names are not shown.'}
          </p>
          {data.groups.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nothing yet. Reviewed topics are covering what clients ask.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius)] border border-border">
              {data.groups.map((group) => (
                <li key={`${group.question}-${group.lastAskedAt}`} className="flex flex-wrap items-start gap-3 bg-panel px-4 py-3">
                  <span className="mt-0.5 inline-flex min-w-[2.25rem] justify-center rounded-full bg-muted px-2 py-0.5 font-mono text-[12px] text-foreground">
                    {group.count}
                    <span className="sr-only"> times asked</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-foreground">{group.question}</p>
                    {group.examples.length > 1 && (
                      <ul className="mt-1 space-y-0.5 text-[12px] text-muted-foreground">
                        {group.examples.slice(1).map((example) => (
                          <li key={example}>Also: {example}</li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Last asked {formatDay(group.lastAskedAt)}
                      {group.generated > 0 ? ` · ${group.generated} AI answered` : ''}
                      {group.handoffs > 0 ? ` · ${group.handoffs} sent to a lead` : ''}
                      {group.companies.length > 0 ? ` · ${group.companies.join(', ')}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadDraftTopic(group.question)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3 text-[12.5px] font-medium text-foreground hover:bg-muted"
                  >
                    <FileDown className="h-4 w-4" aria-hidden /> Draft topic
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageTransition>
  );
}
