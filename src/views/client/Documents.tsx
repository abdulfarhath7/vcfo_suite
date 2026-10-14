"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { MilestoneDocumentLink } from '@/components/common/MilestoneDocumentLink';
import { ClientBoardResolutionCard } from '@/components/client/ClientBoardResolutionCard';
import { collectVaultDocuments, groupVaultDocuments } from '@/lib/vault-documents';
import { findEngagementForClientUser } from '@/lib/checklist-state-key';
import { cn } from '@/lib/utils';

function formatUploadDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ClientDocuments() {
  const { user, engagements, requests, getStateForEngagement } = useApp();

  const engagement = useMemo(
    () => (user ? findEngagementForClientUser(engagements, user) : undefined),
    [engagements, user],
  );

  const milestoneDocs = useMemo(() => {
    if (!engagement) return [];
    return collectVaultDocuments([engagement], getStateForEngagement);
  }, [engagement, getStateForEngagement]);

  const grouped = useMemo(() => {
    if (!engagement) return [];
    return groupVaultDocuments(milestoneDocs, [engagement]);
  }, [engagement, milestoneDocs]);

  const entity = grouped[0];
  const legacyDocs = engagement
    ? requests.filter((r) => r.engagementId === engagement.id)
    : [];
  const uploadedLegacy = legacyDocs.filter((r) => r.status !== 'pending');
  const pendingLegacy = legacyDocs.filter((r) => r.status === 'pending');

  if (!engagement) return null;

  const stats = [
    {
      label: 'Still needed',
      value: pendingLegacy.length,
      accent: pendingLegacy.length > 0 ? 'text-danger-text' : 'text-foreground',
    },
    { label: 'Files on record', value: milestoneDocs.length, accent: 'text-foreground' },
    { label: 'Requests answered', value: uploadedLegacy.length, accent: 'text-foreground' },
    { label: 'Milestones with files', value: entity?.milestones.length ?? 0, accent: 'text-foreground' },
  ];

  return (
    <PageTransition>
      <SEO
        title="Documents — VCFO Suite"
        description="Files you have shared with VCFO and documents we still need from you."
        path="/app/client/documents"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/app/client/overview"
            className="-ml-1.5 inline-flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-[13px] font-medium text-muted-foreground hover:bg-primary-light hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Back to home
          </Link>
          <h1 className="min-w-0 truncate text-[20px] font-semibold tracking-tight text-foreground">Documents</h1>
        </div>
        <p className="truncate text-[13px] text-muted-foreground">{engagement.companyName}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="border border-border bg-panel">
          <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-md border border-border bg-background px-3 py-2">
                <span className={cn('block text-[18px] font-semibold leading-none tabular-nums', stat.accent)}>
                  {stat.value}
                </span>
                <span className="mt-1 block text-[11px] font-medium text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>

          {pendingLegacy.length > 0 ? (
            <section className="border-t border-border">
              <SectionHeading title="Still needed from you" count={pendingLegacy.length} />
              <ul className="divide-y divide-border">
                {pendingLegacy.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-warning" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">{r.label}</span>
                    <span className="shrink-0 rounded-sm bg-warning-light px-1.5 py-px text-[11px] font-semibold text-warning-text">
                      Upload required
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="border-t border-border">
            <SectionHeading title="Files on record" count={milestoneDocs.length} />
            {entity && entity.milestones.length > 0 ? (
              entity.milestones.map((milestone) => {
                const rows = milestone.sections.flatMap((section) =>
                  section.docs.map((doc) => ({ section: section.section, doc })),
                );
                return (
                  <div key={milestone.milestoneId}>
                    <h3 className="flex items-baseline justify-between gap-3 border-b border-border bg-muted/40 px-5 py-2 text-[12.5px] font-semibold text-foreground">
                      {milestone.milestoneTitle}
                      <span className="text-[11.5px] font-medium tabular-nums text-muted-foreground">
                        {rows.length} file{rows.length === 1 ? '' : 's'}
                      </span>
                    </h3>
                    <ul className="divide-y divide-border">
                      {rows.map(({ section, doc }) => (
                        <li
                          key={doc.id}
                          data-ask-focus={doc.id}
                          className="grid items-center gap-x-4 gap-y-0.5 px-5 py-2.5 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem_minmax(0,12rem)]"
                        >
                          <span className="min-w-0 truncate text-[13.5px] font-medium text-foreground">{doc.fieldLabel}</span>
                          <span className="min-w-0 truncate text-[12px] text-muted-foreground">{section}</span>
                          <span className="text-[12px] tabular-nums text-muted-foreground">
                            {formatUploadDate(doc.uploadedAt)}
                          </span>
                          <MilestoneDocumentLink
                            storagePath={doc.storagePath}
                            label={doc.fileName}
                            variant="client"
                            className="min-w-0 justify-self-start break-all text-[12px] sm:justify-self-end"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            ) : (
              <p className="px-5 py-3 text-[13px] text-muted-foreground">
                Nothing uploaded yet. Files you add on your{' '}
                <Link href="/app/client/incorporation" className="font-medium text-primary underline-offset-2 hover:underline">
                  incorporation steps
                </Link>{' '}
                appear here.
              </p>
            )}
          </section>

          {uploadedLegacy.length > 0 ? (
            <section className="border-t border-border">
              <SectionHeading title="Document requests answered" count={uploadedLegacy.length} />
              <ul className="divide-y divide-border">
                {uploadedLegacy.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-foreground">{r.label}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {r.fileName} · {r.uploadedAt}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-sm bg-success-light px-1.5 py-px text-[11px] font-semibold capitalize text-success-text">
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <ClientBoardResolutionCard engagement={engagement} />
      </div>
    </PageTransition>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      <span className="text-[12px] tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}
