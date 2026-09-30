'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AnswerDepth } from '@/data/assist/schema';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { AssistReader } from '@/components/assist/AssistReader';
import { useAssistOptional } from '@/components/assist/assist-context';
import { fetchTopicAnswer } from '@/hooks/assist/assist-api';

/** Full-page topic reader (D3) — no model call; depth switch re-reads the topic. */
export default function ClientLearnTopic() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const assist = useAssistOptional();
  const engagementId = assist?.engagementId ?? null;
  const [depth, setDepth] = useState<AnswerDepth>('normal');
  const query = useQuery({
    queryKey: ['assist', 'topic', slug, depth, engagementId],
    queryFn: () => fetchTopicAnswer(slug, { depth, engagementId }),
    enabled: Boolean(slug && engagementId),
    placeholderData: (prev) => prev,
  });

  if (!engagementId || query.isLoading) return <p className="p-6 text-[13px] text-muted-foreground">Loading…</p>;
  if (query.isError || !query.data) {
    return (
      <p role="alert" className="p-6 text-[13px] text-danger-text">
        This explanation is not available for your company.
      </p>
    );
  }
  const { topic, answer } = query.data;
  return (
    <PageTransition>
      <SEO title={topic.title} description={answer.line} path={`/app/client/learn/${slug}`} />
      <AssistReader
        title={topic.title}
        category={topic.category}
        answer={answer}
        backHref="/app/client/library"
        backLabel="Library"
        onDepth={setDepth}
        depthBusy={query.isFetching}
        topicSlug={topic.slug}
        engagementId={engagementId}
      />
    </PageTransition>
  );
}
