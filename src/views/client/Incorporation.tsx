"use client";

import { useEffect, useMemo } from "react";
import { Building2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageBackButton } from "@/components/shell/PageBackButton";
import { SEO } from "@/components/SEO";
import { ChecklistPhaseJourney } from "@/components/incorporation/ChecklistPhaseJourney";
import { ClientBoardResolutionCard } from "@/components/client/ClientBoardResolutionCard";
import { initialsFromName, type AuthUser } from "@/lib/auth";
import type { Client } from "@/data/mockData";
import type { Engagement } from "@/data/engagements";
import { getActiveCatalogItems, getIncorporationPhases } from "@/data/checklist";
import { isChecklistStepSequentiallyComplete } from "@/lib/checklist-step-gate";
import { formatDate } from "@/lib/deadlines";
import { HexgridLoader } from "@/components/common/HexgridLoader";
import { ProgressRing, EmptyStateIllustrated } from "@/components/noir";
import { findEngagementForClientUser } from "@/lib/checklist-state-key";

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

  const resolved = useMemo(
    () => resolveClientForPortal(user, clients, engagements),
    [user, clients, engagements],
  );
  const client = resolved?.client ?? null;
  const engagement = resolved?.engagement ?? null;
  const phases = useMemo(() => getIncorporationPhases(), []);

  useEffect(() => {
    if (!engagement?.id) return;
    void refreshEngagementChecklist(engagement.id);
  }, [engagement?.id, refreshEngagementChecklist]);

  useEffect(() => {
    if (client) setSelectedClient(client);
    return () => setSelectedClient(null);
  }, [client, setSelectedClient]);

  if (!resolved && engagementsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <HexgridLoader />
      </div>
    );
  }

  if (!resolved) {
    return (
      <EmptyStateIllustrated
        icon={Building2}
        title="No active engagement"
        className="mx-auto max-w-md"
      />
    );
  }

  const state = getStateForEngagement(engagement);
  const catalog = getActiveCatalogItems();
  const totalSteps = catalog.length;
  const totalDone = catalog.filter((item) =>
    isChecklistStepSequentiallyComplete(state[item.id]?.status ?? "not-started", state[item.id]),
  ).length;
  const incLabel = client.incorporationDate
    ? `Incorporated ${formatDate(new Date(client.incorporationDate))}`
    : "Incorporation date pending";

  return (
    <PageTransition>
      <SEO
        title="Incorporation — VCFO Suite"
        description="Track pre- and post-incorporation milestones for your India entity setup with VCFO."
        path="/app/client/incorporation"
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
            <p className="text-sm text-muted-foreground">
              {incLabel} · {totalDone}/{totalSteps} steps
            </p>
          </div>
          <ProgressRing value={Math.round((totalDone / totalSteps) * 100) || 0} size={52} />
        </div>
      </header>

      <ClientBoardResolutionCard engagement={engagement} />

      <ChecklistPhaseJourney
        phases={phases}
        variant="client"
        readOnly
        clientEditable
      />
    </PageTransition>
  );
}
