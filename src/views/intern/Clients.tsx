"use client";

import { useInternPortfolio } from '@/lib/use-intern-portfolio';
import { PageTransition, Stagger, StaggerItem } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { ProgressRing, Eyebrow, EmptyStateIllustrated } from '@/components/noir';
import { useRouter } from 'next/navigation';
import { internEngagementPath } from '@/lib/project-step-path';
import { ArrowUpRight, Building2, UserSquare2 } from 'lucide-react';

export default function InternClients() {
  const { myEngagements, progressByEngagement } = useInternPortfolio();
  const router = useRouter();

  return (
    <PageTransition>
      <SEO title="Clients — VCFO Suite" description="Engagements assigned to you and how far each company is through setup." path="/app/intern/clients" />

      <PageHeader
        accent="cyan"
        icon={Building2}
        eyebrow="Portfolio"
        title="Clients"
        subtitle={`${myEngagements.length} active engagement${myEngagements.length === 1 ? '' : 's'}`}
      />

      {myEngagements.length === 0 ? (
        <EmptyStateIllustrated
          icon={UserSquare2}
          title="No engagements assigned yet"
          description="When your manager assigns projects, they will appear here."
          className="border-primary/25 bg-primary-light/30"
        />
      ) : (
        <Stagger>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {myEngagements.map((e) => {
              const pct = progressByEngagement.get(e.id) ?? 0;
              const initials = e.companyName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
              return (
                <StaggerItem key={e.id}>
                  <button
                    type="button"
                    onClick={() => router.push(internEngagementPath(e))}
                    className="surface group w-full p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-light text-[12px] font-semibold text-primary-dark border border-primary/20">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-foreground">{e.companyName}</div>
                          <Eyebrow className="mt-0.5 text-[10px]">{e.stage}</Eyebrow>
                        </div>
                      </div>
                      <ProgressRing value={pct} size={44} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                </StaggerItem>
              );
            })}
          </div>
        </Stagger>
      )}
    </PageTransition>
  );
}
