"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { MilestoneDocumentLink } from '@/components/common/MilestoneDocumentLink';
import { toneForKey, TONE_BADGE } from '@/components/common/IconChip';
import { EmptyStateIllustrated, Mono, NoirCard, Surface } from '@/components/noir';
import { Input } from '@/components/ui/input';
import {
  collectVaultDocuments,
  groupVaultDocuments,
  type VaultDocument,
} from '@/lib/vault-documents';
import { adminProjectPath } from '@/lib/project-step-path';
import {
  ArrowUpRight,
  Building2,
  FileText,
  FolderOpen,
  Search,
  Vault,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatUploadDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function DocumentCard({ doc, index }: { doc: VaultDocument; index: number }) {
  // Section drives the hue so each document category is visually scannable.
  const sectionTone = TONE_BADGE[toneForKey(doc.section)];
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index }}
      className="h-full"
    >
      <NoirCard flat className="flex h-full flex-col p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', sectionTone)}>
            <FileText className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13.5px] font-medium text-ink">{doc.fileName}</h3>
            <p className="mt-0.5 truncate text-[11.5px] text-text-tertiary">{doc.fieldLabel}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-text-tertiary">
          <span className={cn('inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10.5px] font-medium', sectionTone)}>
            {doc.section}
          </span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <Mono>{formatUploadDate(doc.uploadedAt)}</Mono>
        </div>

        <div className="mt-auto border-t border-border pt-3">
          <MilestoneDocumentLink
            storagePath={doc.storagePath}
            label={doc.fieldLabel}
            className="text-[12.5px] font-medium"
          />
        </div>
      </NoirCard>
    </m.div>
  );
}

function EntityPill({
  active,
  companyName,
  docCount,
  stage,
  onClick,
}: {
  active: boolean;
  companyName: string;
  docCount: number;
  stage: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-left transition-colors',
        active
          ? 'border-brand/25 bg-primary-light text-ink'
          : 'border-border bg-panel text-ink-soft hover:border-primary/20 hover:bg-muted/40',
      )}
    >
      <Building2 className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-brand' : 'text-text-tertiary')} />
      <span className="max-w-[160px] truncate text-[12px] font-medium">{companyName}</span>
      <Mono className="text-[10.5px] text-text-tertiary">{docCount}</Mono>
      <span className="sr-only">{stage}</span>
    </button>
  );
}

function EntitySidebarItem({
  active,
  companyName,
  docCount,
  stage,
  onClick,
}: {
  active: boolean;
  companyName: string;
  docCount: number;
  stage: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-md px-3 py-2.5 text-left transition-colors',
        active ? 'bg-primary-light' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-2.5">
        <Building2 className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-text-tertiary')} />
        <span className="truncate text-[13px] font-medium text-ink">{companyName}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between pl-[26px]">
        <span className="text-[11px] text-text-tertiary">{stage}</span>
        <Mono className="text-[11px] text-text-tertiary">{docCount} files</Mono>
      </div>
    </button>
  );
}

export default function VaultPage() {
  const router = useRouter();
  const { engagements, getStateForEngagement, engagementsLoading, refreshEngagementChecklist } = useApp();
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [checklistRefreshing, setChecklistRefreshing] = useState(false);

  const engagementIds = useMemo(() => engagements.map((e) => e.id), [engagements]);

  useEffect(() => {
    if (engagementsLoading || engagementIds.length === 0) return;
    let cancelled = false;
    setChecklistRefreshing(true);
    void Promise.all(engagementIds.map((id) => refreshEngagementChecklist(id))).finally(() => {
      if (!cancelled) setChecklistRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [engagementIds, engagementsLoading, refreshEngagementChecklist]);

  const allDocs = useMemo(
    () => collectVaultDocuments(engagements, getStateForEngagement),
    [engagements, getStateForEngagement],
  );

  const entityGroups = useMemo(
    () => groupVaultDocuments(allDocs, engagements),
    [allDocs, engagements],
  );

  const selectedEntityId = activeEntityId ?? entityGroups[0]?.engagementId ?? null;
  const selectedEntity = entityGroups.find((g) => g.engagementId === selectedEntityId) ?? null;

  const filteredMilestones = useMemo(() => {
    if (!selectedEntity) return [];
    const query = q.trim().toLowerCase();
    if (!query) return selectedEntity.milestones;

    return selectedEntity.milestones.flatMap((milestone) => {
      const sections = milestone.sections.flatMap((section) => {
        const docs = section.docs.filter(
          (doc) =>
            doc.fileName.toLowerCase().includes(query) ||
            doc.fieldLabel.toLowerCase().includes(query) ||
            doc.section.toLowerCase().includes(query) ||
            doc.milestoneTitle.toLowerCase().includes(query),
        );
        return docs.length > 0 ? [{ ...section, docs }] : [];
      });
      return sections.length > 0 ? [{ ...milestone, sections }] : [];
    });
  }, [selectedEntity, q]);

  const visibleDocCount = filteredMilestones.reduce(
    (sum, m) => sum + m.sections.reduce((s, sec) => s + sec.docs.length, 0),
    0,
  );

  if (engagementsLoading || checklistRefreshing) {
    return (
      <PageTransition>
        <SEO title="Document Vault — VCFO Suite" description="Central evidence repository for GCC setup projects." path="/app/manager/vault" />
        <PageHeader
          accent="teal"
          icon={Vault}
          title="Document Vault"
          subtitle="Client-submitted documents from milestone forms, organized by entity."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <NoirCard key={i} flat className="h-[180px] animate-pulse p-5">
              <div className="mb-3 flex gap-3">
                <div className="h-10 w-10 rounded-md bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
              <div className="mt-auto space-y-2 pt-6">
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </NoirCard>
          ))}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <SEO
        title="Document Vault — VCFO Suite"
        description="Submitted milestone documents organized by entity, milestone, and section."
        path="/app/manager/vault"
      />

      <PageHeader
        accent="teal"
        icon={Vault}
        title="Document Vault"
        subtitle="Client-submitted documents from milestone forms, grouped by entity."
      />

      {entityGroups.length > 0 && (
        <Surface className="mb-5 overflow-hidden">
          <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-5 sm:gap-8">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md role-accent-bg">
                  <Vault className="h-4 w-4 text-role" aria-hidden />
                </div>
                <div>
                  <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">Documents</p>
                  <p className="serif text-[22px] leading-none tabular-nums text-ink">{allDocs.length}</p>
                </div>
              </div>
              <div className="hidden h-10 w-px bg-border sm:block" aria-hidden />
              <div className="hidden sm:block">
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">Entities</p>
                <p className="serif text-[22px] leading-none tabular-nums text-ink">{entityGroups.length}</p>
              </div>
            </div>
            <p className="max-w-sm text-[12px] leading-relaxed text-text-tertiary">
              Milestone uploads across your active GCC setup engagements.
            </p>
          </div>
        </Surface>
      )}

      {entityGroups.length === 0 ? (
        <EmptyStateIllustrated
          icon={FolderOpen}
          title="No submitted documents yet"
          description="Files uploaded through milestone forms (e.g. Pre-Incorporation step 1 KYC) will appear here, organized by company."
          actionLabel="View projects"
          onAction={() => router.push('/app/manager/projects')}
        />
      ) : (
        <>
          <div className="mb-4 lg:hidden">
            <p className="mb-2 text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">Entity</p>
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex gap-2 px-1">
                {entityGroups.map((entity) => (
                  <EntityPill
                    key={entity.engagementId}
                    active={entity.engagementId === selectedEntityId}
                    companyName={entity.companyName}
                    docCount={entity.docCount}
                    stage={entity.stage}
                    onClick={() => setActiveEntityId(entity.engagementId)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[240px_1fr] lg:gap-6">
            <NoirCard flat className="hidden h-fit p-2 lg:block lg:sticky lg:top-4">
              <p className="px-2 py-2 text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">Entities</p>
              <div className="space-y-0.5">
                {entityGroups.map((entity) => (
                  <EntitySidebarItem
                    key={entity.engagementId}
                    active={entity.engagementId === selectedEntityId}
                    companyName={entity.companyName}
                    docCount={entity.docCount}
                    stage={entity.stage}
                    onClick={() => setActiveEntityId(entity.engagementId)}
                  />
                ))}
              </div>
            </NoirCard>

            <div className="min-w-0 space-y-5">
              {selectedEntity && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="serif text-[24px] leading-tight tracking-tight text-ink">
                      {selectedEntity.companyName}
                    </h2>
                    <p className="mt-1 text-[12px] text-text-tertiary">
                      <Mono>{selectedEntity.docCount}</Mono>
                      {' document'}
                      {selectedEntity.docCount === 1 ? '' : 's'}
                      {' · '}
                      {selectedEntity.stage}
                    </p>
                  </div>
                  <Link
                    href={adminProjectPath({
                      id: selectedEntity.engagementId,
                      slug: engagements.find((e) => e.id === selectedEntity.engagementId)?.slug,
                    })}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3.5 text-[12px] font-medium text-brand transition-colors hover:border-brand/30 hover:bg-primary-light/50"
                  >
                    Open project
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              )}

              <Surface className="overflow-hidden">
                <div className="border-b border-border px-4 py-3 sm:px-5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search documents in this entity…"
                      aria-label="Search documents in this entity"
                      className="h-9 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                {filteredMilestones.length === 0 ? (
                  <div className="px-4 py-12 sm:px-5">
                    <EmptyStateIllustrated
                      icon={FileText}
                      title="No documents match your search"
                      description="Try a different file name, field label, or section keyword."
                      className="border-0 bg-transparent py-6"
                    />
                  </div>
                ) : (
                  <div className="space-y-8 px-4 py-5 sm:px-5">
                    {filteredMilestones.map((milestone) => (
                      <section key={milestone.milestoneId} aria-labelledby={`milestone-${milestone.milestoneId}`}>
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
                          <div className="min-w-0">
                            <h3
                              id={`milestone-${milestone.milestoneId}`}
                              className="serif text-[18px] leading-snug text-ink"
                            >
                              {milestone.milestoneTitle}
                            </h3>
                            <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                              {milestone.bucket}
                            </p>
                          </div>
                          <Mono className="shrink-0 text-[11px] text-text-tertiary">
                            {milestone.docCount} file{milestone.docCount === 1 ? '' : 's'}
                          </Mono>
                        </div>

                        {milestone.sections.map((section) => (
                          <div
                            key={`${milestone.milestoneId}-${section.section}`}
                            className="mb-6 last:mb-0"
                          >
                            {milestone.sections.length > 1 && (
                              <p className="mb-3 text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                                {section.section}
                              </p>
                            )}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                              {section.docs.map((doc, i) => (
                                <DocumentCard key={doc.id} doc={doc} index={i} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </Surface>

              {visibleDocCount > 0 && q.trim() && (
                <p className="px-1 text-[11.5px] text-text-tertiary">
                  Showing <Mono>{visibleDocCount}</Mono> matching document{visibleDocCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </PageTransition>
  );
}
