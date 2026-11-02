'use client';

/**
 * Old engagement links — /app/manager/engagements/[id] and the lead's
 * /app/intern/engagements/[id], …/step/[stepId], …/documents,
 * …/board-resolution (emails, notifications, bookmarks, live components that
 * still build those paths). The id (or slug) resolves against the caller's own
 * list, then the URL is replaced with the seat's new page under
 * `${base}/projects/<slug>/…`, keeping the query string (?tab=, ?part=) and the hash.
 */
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { resolveChecklistItemFromStepParam, stepRouteParams } from '@/lib/slug';
import { useCrumbs } from '../../runtime';
import { Loading, NotFound, useClientPaths, useRouteEngagement } from './shared';

export function EngagementRedirect({ to = 'overview' }: { to?: 'overview' | 'step' | 'documents' | 'board-resolution' }) {
  const paths = useClientPaths();
  const { eng, settled } = useRouteEngagement();
  const params = useParams() as Record<string, string | string[] | undefined>;
  const { stepParam } = stepRouteParams(params);
  const router = useRouter();
  useCrumbs(['Clients']);
  useEffect(() => {
    if (!eng) return;
    const item = to === 'step' ? resolveChecklistItemFromStepParam(stepParam) : undefined;
    const target =
      to === 'step'
        ? item
          ? paths.step(eng, item)
          : paths.project(eng)
        : to === 'documents'
          ? paths.docs(eng)
          : to === 'board-resolution'
            ? paths.boardResolution(eng)
            : paths.project(eng);
    router.replace(target + window.location.search + window.location.hash);
  }, [eng, to, stepParam, paths, router]);
  if (!eng) return <NotFound settled={settled} />;
  return <Loading label="Opening the client…" />;
}
