"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, ChevronLeft } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageBackButton } from "@/components/shell/PageBackButton";
import { SEO } from "@/components/SEO";
import { ChecklistPhaseJourney } from "@/components/incorporation/ChecklistPhaseJourney";
import { InternPhaseEntryCards } from "@/components/incorporation/InternOverviewProgress";
import { ClientBoardResolutionCard } from "@/components/client/ClientBoardResolutionCard";
import { initialsFromName, type AuthUser } from "@/lib/auth";
import type { Client } from "@/data/mockData";
import type { Engagement } from "@/data/engagements";
import { getActiveCatalogItems } from "@/data/checklist";
import {
  gateActiveCatalog,
  isChecklistStepSequentiallyComplete,
} from "@/lib/checklist-step-gate";
import {
  internOverviewPhaseTitle,
  internOverviewPhases,
} from "@/lib/intern-overview-progress";
import { formatDate } from "@/lib/deadlines";
import { HexgridLoader } from "@/components/common/HexgridLoader";
import { ProgressRing, EmptyStateIllustrated } from "@/components/noir";
import { findEngagementForClientUser } from "@/lib/checklist-state-key";

const INCORPORATION_HREF = "/app/client/incorporation";

function resolveClientForPortal(
  user: AuthUser | null,
  clients: Client[],
  engagements: Engagement[],
): { client: Client; engagement: Engagement } | null {
  if (!user || user.role !== "client") return null;

  const eng = findEngagementForClientUser(engagements, user);
  if (!eng) return null;

  const storageId = eng.id;
  const existing =
    clients.find((c) => c.id === storageId) ?? clients.find((c) => c.id === eng.clientId);
  const client =
    existing ??
    ({
      id: storageId,
      name: eng.clientDisplayName?.trim() || eng.companyName,
      initials: initialsFromName(eng.companyName),
      stage: eng.stage,
      unread: 0,
      incorporationDate: null,
      nature: "",
      shareCapital: 0,
    } satisfies Client);

  return { client, engagement: eng };
}

/**
 * CLIENT INCORPORATION.
 *
 * Two levels, the same shape the lead dashboard uses for a project:
 *   L1 — four phase rows (SPICe+ Part A / Part B / Post-incorporation /
 *        Registration), each with a tick track and n/m, clicked to go in.
 *   L2 — `?phase=` opens that phase's steps in the client wizard.
 *
 * The rows are `InternPhaseEntryCards`, the lead's own component, so the two
 * surfaces are the same object rather than lookalikes. Sequencing is unchanged:
 * gates come from `gateActiveCatalog`, and a locked step stays locked.
 */
export default function ClientIncorporation() {
  const {
    user,
    clients,
    engagements,
    engagementsLoading,
    setSelectedClient,
    getStateForEngagement,
    refreshEngagementChecklist,
  } = useApp();

  const params = useSearchParams();
  const resolved = useMemo(
    () => resolveClientForPortal(user, clients, engagements),
    [user, clients, engagements],
  );
  const client = resolved?.client ?? null;
  const engagement = resolved?.engagement ?? null;
  const phases = useMemo(() => internOverviewPhases(), []);

  useEffect(() => {
    if (!engagement?.id) return;
    void refreshEngagementChecklist(engagement.id);
  }, [engagement?.id, refreshEngagementChecklist]);

  useEffect(() => {
    if (client) setSelectedClient(client);
    return () => setSelectedClient(null);
  }, [client, setSelectedClient]);

  const state = useMemo(
    () => (engagement ? getStateForEngagement(engagement) : {}),
    [engagement, getStateForEngagement],
  );
  const gates = useMemo(() => gateActiveCatalog(state, "client"), [state]);

  // `?phase=` is the drill-in. A `?step=` link from an email opens the phase
  // that owns that step, so the wizard can still select it.
  const requestedPhase = params.get("phase");
  const requestedStep = params.get("step");
  const activePhase = useMemo(() => {
    if (requestedPhase) {
      return phases.find((phase) => phase.id === requestedPhase) ?? null;
    }
    if (requestedStep) {
      return phases.find((phase) => phase.items.some((item) => item.id === requestedStep)) ?? null;
    }
    return null;
  }, [phases, requestedPhase, requestedStep]);

  if (!resolved || !engagement) {
    if (engagementsLoading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <HexgridLoader />
        </div>
      );
    }
    return (
      <EmptyStateIllustrated
        icon={Building2}
        title="No active engagement"
        className="mx-auto max-w-md"
      />
    );
  }

  const catalog = getActiveCatalogItems();
  const totalSteps = catalog.length;
  const totalDone = catalog.filter((item) =>
    isChecklistStepSequentiallyComplete(state[item.id]?.status ?? "not-started", state[item.id]),
  ).length;
  // The engagement row is the source of truth for the date; the legacy `Client`
  // record only carries one when a mock entry happens to exist.
  const incorporationDate = engagement.incorporationDate ?? resolved.client.incorporationDate;

  return (
    <PageTransition>
      <SEO
        title="Incorporation — VCFO Suite"
        description="Track pre- and post-incorporation milestones for your India entity setup with VCFO."
        path={INCORPORATION_HREF}
      />

      <header className="mb-4 sm:mb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex min-w-0 items-center gap-1.5">
              <PageBackButton className="-ml-1.5" />
              <h1 className="serif min-w-0 text-2xl tracking-tight text-foreground sm:text-3xl">
                {engagement.companyName}
              </h1>
            </div>
            <p className="font-mono text-[11px] tabular-nums text-text-tertiary">
              {totalDone}/{totalSteps}
              {incorporationDate ? ` · ${formatDate(new Date(incorporationDate))}` : ""}
            </p>
          </div>
          <ProgressRing value={Math.round((totalDone / totalSteps) * 100) || 0} size={52} />
        </div>
      </header>

      {activePhase ? (
        <div className="flex flex-col gap-3">
          <Link
            href={INCORPORATION_HREF}
            className="inline-flex w-fit items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            {internOverviewPhaseTitle(activePhase.id, activePhase.title)}
          </Link>

          <ChecklistPhaseJourney
            phases={[
              {
                id: activePhase.id,
                title: activePhase.title,
                itemIds: activePhase.items.map((item) => item.id),
                items: activePhase.items,
              },
            ]}
            variant="client"
            readOnly
            clientEditable
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ClientBoardResolutionCard engagement={engagement} />
          <InternPhaseEntryCards
            phases={phases}
            gates={gates}
            hrefForPhase={(phaseId) => `${INCORPORATION_HREF}?phase=${phaseId}`}
          />
        </div>
      )}
    </PageTransition>
  );
}
