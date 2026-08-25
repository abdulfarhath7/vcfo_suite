"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  collectIndexedVaultDocuments,
  collectVaultDocuments,
  filterVaultEntityGroups,
  groupVaultDocuments,
  mergeVaultDocuments,
  scopeVaultDocumentsToEngagements,
  vaultSearchHits,
  type VaultDocument,
} from '@/lib/vault-documents';
import { internVisibleDocuments } from '@/lib/document-access';
import { getIndexedDocumentSignedUrl, useIndexedDocuments } from '@/lib/use-vault-documents';
import { isMilestoneStoragePath } from '@/lib/milestone-document-storage';
import { adminProjectPath, internEngagementPath } from '@/lib/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import {
  ArrowUpRight,
  Building2,
  ExternalLink,
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

function IndexedDocumentLink({
  documentId,
  fileName,
  className,
}: {
  documentId: string;
  fileName: string;
  className?: string;
}) {
  const [href, setHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getIndexedDocumentSignedUrl(documentId).then((url) => {
      if (!cancelled) {
        setHref(url);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (loading) {
    return <span className={cn('text-sm italic text-text-tertiary', className)}>Loading…</span>;
  }
  if (!href) {
    return (
      <span className={cn('text-sm text-text-tertiary', className)}>
        {fileName} (link unavailable)
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand underline-offset-2 hover:underline',
        className,
      )}
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {fileName}
    </a>
  );
}

function DocumentOpenLink({ doc }: { doc: VaultDocument }) {
  if (doc.source === 'index' && doc.documentId && !isMilestoneStoragePath(doc.storagePath)) {
    return <IndexedDocumentLink documentId={doc.documentId} fileName={doc.fileName} />;
  }
  return (
    <MilestoneDocumentLink
      storagePath={doc.storagePath}
      label={doc.fieldLabel}
      className="text-[12.5px] font-medium"
    />
  );
}

function DocumentCard({
  doc,
  index,
  location,
}: {
  doc: VaultDocument;
  index: number;
  location?: string;
}) {
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
            <p className="mt-0.5 truncate text-[11.5px] text-text-tertiary">
              {location ?? doc.fieldLabel}
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-text-tertiary">
          <span className={cn('inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10.5px] font-medium', sectionTone)}>
            {location ? doc.companyName : doc.section}
          </span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <Mono>{formatUploadDate(doc.uploadedAt)}</Mono>
        </div>

        <div className="mt-auto border-t border-border pt-3">
          <DocumentOpenLink doc={doc} />
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
        <Mono className="text-[11px] text-text-tertiary">
          {docCount} {docCount === 1 ? 'file' : 'files'}
        </Mono>
      </div>
    </button>
  );
}

export default function DocumentVaultPage() {
  return (
    <Suspense fallback={<VaultPageSkeleton />}>
      <DocumentVaultPageContent />
    </Suspense>
  );
}

function VaultPageSkeleton() {
  return (
    <PageTransition>
      <SEO title="Document Vault — VCFO Suite" description="Central evidence repository for GCC setup projects." path="/app/intern/vault" />
      <PageHeader accent="teal" icon={Vault} title="Vault" />
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
          </NoirCard>
        ))}
      </div>
    </PageTransition>
  );
}

function DocumentVaultPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const staffBase = useStaffBasePath();
  const { user, engagements, getStateForEngagement, engagementsLoading, refreshEngagementChecklist } = useApp();
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const urlQ = searchParams.get('q') ?? '';
  const [q, setQ] = useState(urlQ);

  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);
  const [checklistRefreshing, setChecklistRefreshing] = useState(false);

  const isIntern = user?.role === 'intern' || pathname.startsWith('/app/intern/');
  const vaultPath = isIntern ? '/app/intern/vault' : `${staffBase}/vault`;
  const portfolioHref = isIntern ? '/app/intern/clients' : `${staffBase}/projects`;
  const portfolioLabel = isIntern ? 'View clients' : 'View projects';

  const engagementIds = useMemo(() => engagements.map((e) => e.id), [engagements]);
  const indexedQuery = useIndexedDocuments(Boolean(user) && !engagementsLoading);

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

  const allDocs = useMemo(() => {
    const milestoneDocs = collectVaultDocuments(engagements, getStateForEngagement);
    const indexedDocs = collectIndexedVaultDocuments(indexedQuery.data ?? [], engagements);
    const merged = scopeVaultDocumentsToEngagements(
      mergeVaultDocuments(milestoneDocs, indexedDocs),
      engagements,
    );
    if (user?.role === 'intern') {
      return internVisibleDocuments(user.internId, merged, engagements);
    }
    return merged;
  }, [engagements, getStateForEngagement, indexedQuery.data, user?.internId, user?.role]);

  const entityGroups = useMemo(
    () => groupVaultDocuments(allDocs, engagements, { includeEmpty: true }),
    [allDocs, engagements],
  );

  const filteredGroups = useMemo(
    () => filterVaultEntityGroups(entityGroups, q),
    [entityGroups, q],
  );

  const searchHits = useMemo(() => vaultSearchHits(allDocs, q), [allDocs, q]);
  const isSearching = q.trim().length > 0;

  const selectedEntityId =
    (activeEntityId && filteredGroups.some((g) => g.engagementId === activeEntityId)
      ? activeEntityId
      : null) ??
    filteredGroups[0]?.engagementId ??
    null;
  const selectedEntity = filteredGroups.find((g) => g.engagementId === selectedEntityId) ?? null;

  const projectHref = (engagementId: string, slug?: string) => {
    const target = { id: engagementId, slug };
    return isIntern ? internEngagementPath(target) : adminProjectPath(target, staffBase);
  };

  if (engagementsLoading || checklistRefreshing) {
    return (
      <PageTransition>
        <SEO title="Document Vault — VCFO Suite" description="Central evidence repository for GCC setup projects." path={vaultPath} />
        <PageHeader
          accent="teal"
          icon={Vault}
          title="Vault"
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
        description="Submitted documents organized by company, checklist step, and section."
        path={vaultPath}
      />

      <PageHeader
        accent="teal"
        icon={Vault}
        title="Vault"
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
                <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                  {isIntern ? 'Clients' : 'Entities'}
                </p>
                <p className="serif text-[22px] leading-none tabular-nums text-ink">{entityGroups.length}</p>
              </div>
            </div>
          </div>
        </Surface>
      )}

      {entityGroups.length === 0 ? (
        <EmptyStateIllustrated
          icon={FolderOpen}
          title={isIntern ? 'No clients assigned yet' : 'No submitted documents yet'}
          actionLabel={portfolioLabel}
          onAction={() => router.push(portfolioHref)}
        />
      ) : (
        <>
          <div className="mb-4 lg:hidden">
            <p className="mb-2 text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
              {isIntern ? 'Client' : 'Entity'}
            </p>
            <div className="-mx-1 overflow-x-auto pb-1">
              <div className="flex gap-2 px-1">
                {filteredGroups.map((entity) => (
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
              <p className="px-2 py-2 text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                {isIntern ? 'Clients' : 'Entities'}
              </p>
              <div className="space-y-0.5">
                {filteredGroups.length === 0 ? (
                  <p className="px-3 py-3 text-[12px] text-text-tertiary">No clients match this search.</p>
                ) : (
                  filteredGroups.map((entity) => (
                    <EntitySidebarItem
                      key={entity.engagementId}
                      active={entity.engagementId === selectedEntityId}
                      companyName={entity.companyName}
                      docCount={entity.docCount}
                      stage={entity.stage}
                      onClick={() => setActiveEntityId(entity.engagementId)}
                    />
                  ))
                )}
              </div>
            </NoirCard>

            <div className="min-w-0 space-y-5">
              {isSearching ? (
                <div className="min-w-0">
                  <h2 className="serif text-[24px] leading-tight tracking-tight text-ink">Results</h2>
                  <p className="mt-1 text-[12px] text-text-tertiary">
                    <Mono>{searchHits.length}</Mono>
                    {' file'}
                    {searchHits.length === 1 ? '' : 's'}
                    {' matching “'}
                    {q.trim()}
                    {'”'}
                  </p>
                </div>
              ) : selectedEntity ? (
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
                    href={projectHref(
                      selectedEntity.engagementId,
                      selectedEntity.slug ??
                        engagements.find((e) => e.id === selectedEntity.engagementId)?.slug,
                    )}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3.5 text-[12px] font-medium text-brand transition-colors hover:border-brand/30 hover:bg-primary-light/50"
                  >
                    {isIntern ? 'Open client' : 'Open project'}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              ) : null}

              <Surface className="overflow-hidden">
                <div className="border-b border-border px-4 py-3 sm:px-5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search by document name…"
                      aria-label="Search by document name"
                      className="h-9 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                {isSearching ? (
                  searchHits.length === 0 ? (
                    <div className="px-4 py-12 sm:px-5">
                      <EmptyStateIllustrated
                        icon={FileText}
                        title="No documents match your search"
                        className="border-0 bg-transparent py-6"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 px-4 py-5 md:grid-cols-2 xl:grid-cols-3 sm:px-5">
                      {searchHits.map((hit, i) => (
                        <DocumentCard
                          key={hit.doc.id}
                          doc={hit.doc}
                          index={i}
                          location={`${hit.companyName} · ${hit.location}`}
                        />
                      ))}
                    </div>
                  )
                ) : !selectedEntity ? (
                  <div className="px-4 py-12 sm:px-5">
                    <EmptyStateIllustrated
                      icon={FileText}
                      title="No documents match your search"
                      className="border-0 bg-transparent py-6"
                    />
                  </div>
                ) : selectedEntity.docCount === 0 ? (
                  <div className="px-4 py-12 sm:px-5">
                    <EmptyStateIllustrated
                      icon={FolderOpen}
                      title="No files for this client yet"
                      className="border-0 bg-transparent py-6"
                    />
                  </div>
                ) : (selectedEntity.phases?.length ? selectedEntity.phases : []).length === 0 ? (
                  <div className="px-4 py-12 sm:px-5">
                    <EmptyStateIllustrated
                      icon={FileText}
                      title="No documents match your search"
                      className="border-0 bg-transparent py-6"
                    />
                  </div>
                ) : (
                  <div className="space-y-10 px-4 py-5 sm:px-5">
                    {(selectedEntity.phases ?? []).map((phase) => (
                      <section key={phase.phaseKey} aria-labelledby={`phase-${phase.phaseKey}`}>
                        <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
                          <h3
                            id={`phase-${phase.phaseKey}`}
                            className="serif text-[20px] leading-snug text-ink"
                          >
                            {phase.phaseLabel}
                          </h3>
                          <Mono className="shrink-0 text-[11px] text-text-tertiary">
                            {phase.docCount} file{phase.docCount === 1 ? '' : 's'}
                          </Mono>
                        </div>
                        <div className="space-y-8">
                          {phase.milestones.map((milestone) => (
                            <div key={milestone.milestoneId}>
                              <div className="mb-3 min-w-0">
                                <p className="text-[13px] font-medium text-ink">{milestone.milestoneTitle}</p>
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
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </Surface>
            </div>
          </div>
        </>
      )}
    </PageTransition>
  );
}
