'use client';

/**
 * Home data: the shared step model + ClientOverview + the Home aggregate
 * (`/api/client/home`), combined once and handed to every card.
 */
import { companyShortName } from '@/lib/client-portal/company';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePortal } from '@/components/client-portal/PortalProvider';
import { usePortalIncorporation, todayIST } from '@/components/client-portal/hooks';
import { useClientOverview } from '@/lib/use-client-overview';
import type { ClientHome } from '@/lib/client/client-home';
import {
  buildAlerts,
  buildDocs,
  buildNeeds,
  buildPostInc,
  buildRegistrations,
  buildTimeline,
  bucketOf,
} from './derive';

export const HOME_QUERY_KEY = 'client-home';

export function useHomeQuery(engagementId: string | undefined) {
  return useQuery({
    queryKey: [HOME_QUERY_KEY, engagementId ?? 'mine'],
    queryFn: async (): Promise<ClientHome | null> => {
      const q = engagementId ? `?engagementId=${encodeURIComponent(engagementId)}` : '';
      const res = await fetch(`/api/client/home${q}`, { cache: 'no-store' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Could not load your dashboard');
      return ((await res.json()) as { home: ClientHome }).home;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useHome() {
  const portal = usePortal();
  const { shell, after } = portal;
  const { model, engagement, loading: modelLoading } = usePortalIncorporation();
  const ov = useClientOverview();
  const homeQ = useHomeQuery(shell?.engagementId);
  const overview = ov.data?.overview ?? undefined;
  const home = homeQ.data ?? undefined;
  const today = todayIST();
  const company = shell?.companyShort || companyShortName(overview?.engagement.companyName) || 'You';
  const companyName = overview?.engagement.companyName ?? shell?.companyName ?? '';

  const derived = useMemo(() => {
    const filings = home?.filings.rows ?? [];
    const filingsById = new Map(filings.map((f) => [f.id, f]));
    const needs = buildNeeds(model, home, filingsById);
    const alerts = buildAlerts(after, today, model, needs, filings, company);
    const timeline = buildTimeline(model, overview?.engagement.incorporationDate);
    const regs = buildRegistrations(model);
    const post = buildPostInc(model, overview?.engagement.incorporationDate, today);
    const docs = buildDocs(home, overview);
    const buckets = { filed: 0, dueSoon: 0, overdue: 0, upcoming: 0 };
    for (const f of filings) buckets[bucketOf(f, today)] += 1;
    return { filings, needs, alerts, timeline, regs, post, docs, buckets };
  }, [model, home, overview, after, today, company]);

  const lead = overview?.team.find((t) => t.role === 'Project Lead')?.name ?? shell?.team.find((t) => t.role === 'Project Lead')?.name;
  const manager = overview?.team.find((t) => t.role === 'Project Manager')?.name ?? shell?.team.find((t) => t.role === 'Project Manager')?.name;

  return {
    portal,
    after,
    today,
    company,
    companyName,
    model,
    engagement,
    overview,
    home,
    lead,
    manager,
    engagementId: shell?.engagementId ?? overview?.engagement.id,
    loading: modelLoading || ov.isPending || homeQ.isPending || !shell,
    error: (ov.error || homeQ.error) as Error | null,
    missing: ov.data?.missing === true || homeQ.data === null,
    refetch: () => {
      void ov.refetch();
      void homeQ.refetch();
    },
    ...derived,
  };
}

export type HomeData = ReturnType<typeof useHome>;
