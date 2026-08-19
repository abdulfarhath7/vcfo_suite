"use client";

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { PageTransition, Stagger, StaggerItem } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { MilestoneDocumentLink } from '@/components/common/MilestoneDocumentLink';
import { EmptyStateIllustrated, Surface, Eyebrow } from '@/components/noir';
import { ClientBoardResolutionCard } from '@/components/client/ClientBoardResolutionCard';
import { collectVaultDocuments, groupVaultDocuments } from '@/lib/vault-documents';
import { findEngagementForClientUser } from '@/lib/checklist-state-key';
import { FileCheck2, FileText, FolderOpen } from 'lucide-react';

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

  return (
    <PageTransition>
      <SEO
        title="Documents — VCFO Suite"
        description="Files you have shared with VCFO and documents we still need from you."
        path="/app/client/documents"
      />

      <PageHeader
        accent="teal"
        icon={FolderOpen}
        eyebrow="Document vault"
        title="Documents"
        subtitle={`${milestoneDocs.length} milestone upload${milestoneDocs.length === 1 ? '' : 's'}${uploadedLegacy.length ? ` · ${uploadedLegacy.length} request${uploadedLegacy.length === 1 ? '' : 's'} on file` : ''}${pendingLegacy.length ? ` · ${pendingLegacy.length} still needed` : ''}`}
      />

      <ClientBoardResolutionCard engagement={engagement} />

      {entity ? (
        <Stagger>
          <div className="mb-8 space-y-6">
            {entity.milestones.map((milestone) => (
              <StaggerItem key={milestone.milestoneId}>
                <section>
                  <Eyebrow className="mb-2">{milestone.milestoneTitle}</Eyebrow>
                  <Surface className="divide-y divide-border overflow-hidden">
                    {milestone.sections.map((section) =>
                      section.docs.map((doc) => (
                        <div key={doc.id} className="flex min-h-11 items-center gap-3 border-l-[3px] border-l-phase-filing px-4 py-3.5 transition-colors hover:bg-primary-light/40">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-phase-filing-soft">
                            <FileCheck2 className="h-4 w-4 shrink-0 text-phase-filing-text" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-foreground">{doc.fieldLabel}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {section.section} · {formatUploadDate(doc.uploadedAt)}
                            </div>
                          </div>
                          <MilestoneDocumentLink
                            storagePath={doc.storagePath}
                            label={doc.fileName}
                            variant="client"
                            className="shrink-0 text-[12px] min-h-11 inline-flex items-center"
                          />
                        </div>
                      )),
                    )}
                  </Surface>
                </section>
              </StaggerItem>
            ))}
          </div>
        </Stagger>
      ) : (
        <EmptyStateIllustrated
          icon={FolderOpen}
          title="No milestone documents yet"
          description="Complete forms under Incorporation to add files here."
          actionLabel="Open incorporation"
          onAction={() => window.location.assign('/app/client/incorporation')}
          className="mb-8"
        />
      )}

      {uploadedLegacy.length > 0 && (
        <>
          <Eyebrow className="mb-2">Document requests on file</Eyebrow>
          <Surface className="mb-6 divide-y divide-border overflow-hidden">
            {uploadedLegacy.map((r) => (
              <div key={r.id} className="flex min-h-11 items-center gap-3 px-4 py-3.5">
                <FileCheck2 className="h-4 w-4 text-success" />
                <div className="flex-1">
                  <div className="text-[13px] text-foreground">{r.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.fileName} · {r.uploadedAt}
                  </div>
                </div>
                <span className="rounded-full bg-success-light px-2 py-0.5 text-[11px] capitalize text-success-text">{r.status}</span>
              </div>
            ))}
          </Surface>
        </>
      )}

      {pendingLegacy.length > 0 && (
        <>
          <Eyebrow className="mb-2">Still needed</Eyebrow>
          <Surface className="divide-y divide-border overflow-hidden">
            {pendingLegacy.map((r) => (
              <div key={r.id} className="flex min-h-11 items-center gap-3 px-4 py-3.5">
                <FileText className="h-4 w-4 text-warning" />
                <div className="flex-1 text-[13px] text-foreground">{r.label}</div>
                <span className="rounded-full bg-warning-light px-2 py-0.5 text-[11px] text-warning-text">Upload required</span>
              </div>
            ))}
          </Surface>
        </>
      )}
    </PageTransition>
  );
}
