'use client';

/**
 * /app/<seat>/registrations/<engagementId>~<stepId> — the old shell's "one registration" page.
 * In the console a registration is worked on its step page (the Registrations list opens it
 * there), so this address resolves the client against the caller's own book and forwards to
 * `${base}/projects/<slug>/step/<step>`; a client outside the book says so.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { getItem } from '@/data/checklist';
import { resolveEngagementFromRouteParam } from '@/lib/slug';
import { parseRegistrationKey } from '@/views/compliances/registration-rows';
import { useConsole, useCrumbs } from '../../runtime';
import { clientPaths } from '../clients/model';
import { Loading, NotFound } from '../clients/shared';

export function RegistrationOpen({ recordKey }: { recordKey: string }) {
  const { base } = useConsole();
  const { engagements, engagementsSettled } = useApp();
  const router = useRouter();
  useCrumbs(['Registrations']);
  const parsed = parseRegistrationKey(recordKey);
  const eng = parsed ? resolveEngagementFromRouteParam(engagements, parsed.engagementId) : undefined;
  const itemId = parsed && getItem(parsed.itemId) ? parsed.itemId : null;
  useEffect(() => {
    if (!eng) return;
    const paths = clientPaths(base);
    router.replace(itemId ? paths.step(eng, itemId) : paths.project(eng));
  }, [eng, itemId, base, router]);
  if (!parsed) return <NotFound settled what="This registration" />;
  if (!eng) return <NotFound settled={engagementsSettled} what="This registration's client" />;
  return <Loading label="Opening the registration step…" />;
}
