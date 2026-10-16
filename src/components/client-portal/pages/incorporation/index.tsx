'use client';

/**
 * Incorporation area entry points for the app/app/client/** page files.
 * Inside the client portal (a signed-in client) they render the v7 pages;
 * anywhere else (a super admin on the staff AppShell) the existing views.
 */
import { Suspense, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getActiveCatalogItems } from '@/data/checklist';
import { clientIncorporationStepPath } from '@/lib/project-step-path';
import { usePortalOptional } from '../../PortalProvider';
import { phaseHref } from '../../routes';
import IncorporationLanding from './Landing';
import PhasePage from './PhasePage';
import StepPage from './StepPage';
import BoardPage from './BoardPage';

const LegacyIncorporation = dynamic(() => import('@/views/client/Incorporation'), { ssr: false });
const LegacyStep = dynamic(() => import('@/views/engagement/EngagementStepDetailClient'), { ssr: false });
const LegacyBoard = dynamic(() => import('@/views/client/BoardResolutionView'), { ssr: false });

const PHASE_KEYS: Record<string, number> = {
  'pre-inc-phase-1': 1,
  'pre-inc-phase-2': 2,
  'post-inc-phase-3': 3,
  'registration-phase-4': 4,
  'part-a': 1,
  'part-b': 2,
  'post-incorporation': 3,
  registration: 4,
};

/** `?step=` (email deep links) → the step page; `?phase=` → the phase page. */
function DeepLinks() {
  const params = useSearchParams();
  const router = useRouter();
  const step = params.get('step');
  const phase = params.get('phase');
  useEffect(() => {
    if (step) {
      const item = getActiveCatalogItems().find((r) => r.id === step || r.slug === step);
      if (item) {
        router.replace(clientIncorporationStepPath(item));
        return;
      }
    }
    if (phase) {
      const n = PHASE_KEYS[phase] ?? Number.parseInt(phase, 10);
      if (n >= 1 && n <= 4) router.replace(phaseHref(n));
    }
  }, [step, phase, router]);
  return null;
}

export function IncorporationRoute() {
  const portal = usePortalOptional();
  return (
    <>
      <Suspense fallback={null}>
        <DeepLinks />
      </Suspense>
      {portal ? <IncorporationLanding /> : <LegacyIncorporation />}
    </>
  );
}

export function PhaseRoute() {
  const portal = usePortalOptional();
  const params = useParams<{ n: string }>();
  const raw = String(params?.n ?? '1');
  const n = PHASE_KEYS[raw] ?? Number.parseInt(raw, 10);
  const router = useRouter();
  useEffect(() => {
    if (!portal) router.replace(`/app/client/incorporation`);
  }, [portal, router]);
  if (!portal) return null;
  return <PhasePage phaseNo={n >= 1 && n <= 4 ? n : 1} />;
}

export function StepRoute() {
  const portal = usePortalOptional();
  const params = useParams<{ stepId: string }>();
  if (!portal) return <LegacyStep />;
  return <StepPage stepParam={String(params?.stepId ?? '')} />;
}

export function BoardRoute() {
  const portal = usePortalOptional();
  return portal ? <BoardPage /> : <LegacyBoard />;
}
