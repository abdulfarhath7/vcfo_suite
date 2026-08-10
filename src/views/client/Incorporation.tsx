"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { PageTransition } from "@/components/shell/PageTransition";
import { SEO } from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreIncSection } from "@/views/incorporation/sections/PreIncSection";
import { PostIncSection } from "@/views/incorporation/sections/PostIncSection";
import { RegistrationSection } from "@/views/incorporation/sections/RegistrationSection";
import { initialsFromName, type AuthUser } from "@/lib/auth";
import type { Client } from "@/data/mockData";
import type { Engagement } from "@/data/engagements";
import { itemsByBucket } from "@/data/checklist";
import { formatDate } from "@/lib/deadlines";
import { HexgridLoader } from "@/components/common/HexgridLoader";
import { ProgressRing, EmptyStateIllustrated } from "@/components/noir";
import { findEngagementForClientUser } from "@/lib/checklist-state-key";
import { cn } from "@/lib/utils";

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
  const [tab, setTab] = useState("pre");

  const resolved = useMemo(
    () => resolveClientForPortal(user, clients, engagements),
    [user, clients, engagements],
  );
  const client = resolved?.client ?? null;
  const engagement = resolved?.engagement ?? null;

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
        description="We could not find an incorporation project for your account yet."
        className="mx-auto max-w-md"
      />
    );
  }

  const state = getStateForEngagement(engagement);
  const preItems = itemsByBucket("pre-inc");
  const postItems = itemsByBucket("post-inc");
  const regItems = itemsByBucket("statutory");
  const preDone = preItems.filter((i) => state[i.id]?.status === "completed").length;
  const postDone = postItems.filter((i) => state[i.id]?.status === "completed").length;
  const regDone = regItems.filter((i) => state[i.id]?.status === "completed").length;
  const totalSteps = preItems.length + postItems.length + regItems.length;
  const totalDone = preDone + postDone + regDone;
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
            <h1 className="serif mb-1 text-2xl tracking-tight text-foreground sm:text-3xl">
              {engagement.companyName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {incLabel} · {totalDone}/{totalSteps} steps
            </p>
          </div>
          <ProgressRing value={Math.round((totalDone / totalSteps) * 100) || 0} size={52} />
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList
          className={cn(
            'h-auto w-full max-w-lg grid grid-cols-3 gap-1 p-1',
            'bg-raised/80 border border-border rounded-lg',
          )}
        >
          <TabsTrigger
            value="pre"
            className="data-[state=active]:bg-panel data-[state=active]:text-role-foreground data-[state=active]:border data-[state=active]:role-accent-border rounded-md text-xs sm:text-sm py-2.5 min-h-[44px] px-1.5 sm:px-3"
          >
            <span className="sm:hidden">Pre</span>
            <span className="hidden sm:inline">Pre-incorporation</span>
            <span className="ml-1 text-[10px] text-text-tertiary tabular-nums">
              {preDone}/{preItems.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="post"
            className="data-[state=active]:bg-panel data-[state=active]:text-role-foreground data-[state=active]:border data-[state=active]:role-accent-border rounded-md text-xs sm:text-sm py-2.5 min-h-[44px] px-1.5 sm:px-3"
          >
            <span className="sm:hidden">Post</span>
            <span className="hidden sm:inline">Post-incorporation</span>
            <span className="ml-1 text-[10px] text-text-tertiary tabular-nums">
              {postDone}/{postItems.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="registration"
            className="data-[state=active]:bg-panel data-[state=active]:text-role-foreground data-[state=active]:border data-[state=active]:role-accent-border rounded-md text-xs sm:text-sm py-2.5 min-h-[44px] px-1.5 sm:px-3"
          >
            <span className="sm:hidden">Reg</span>
            <span className="hidden sm:inline">Registration</span>
            <span className="ml-1 text-[10px] text-text-tertiary tabular-nums">
              {regDone}/{regItems.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pre" className="mt-0 focus-visible:outline-none">
          <PreIncSection readOnly clientEditable variant="client" />
        </TabsContent>
        <TabsContent value="post" className="mt-0 focus-visible:outline-none">
          <PostIncSection readOnly clientEditable variant="client" />
        </TabsContent>
        <TabsContent value="registration" className="mt-0 focus-visible:outline-none">
          <RegistrationSection readOnly clientEditable variant="client" />
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
