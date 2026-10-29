"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackCluster } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  collectIndexedVaultDocuments,
  collectVaultDocuments,
  filterVaultEntityGroups,
  groupVaultDocuments,
  mergeVaultDocuments,
  scopeVaultDocumentsToEngagements,
  vaultSearchHits,
} from '@/lib/documents/vault-documents';
import { internVisibleDocuments } from '@/lib/documents/document-access';
import { useIndexedDocuments } from '@/hooks/use-vault-documents';
import { adminProjectPath, internEngagementPath } from '@/lib/projects/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { ArrowUpRight, Download, Search, Upload } from 'lucide-react';
import { VaultFileRow, VaultFolderRow, VaultPreviewPane } from '@/views/vault/vault-explorer-parts';
import { buildVaultTree, type VaultTreeView } from '@/views/vault/vault-tree';
import {
  entityDocs as allEntityDocs,
  folderDocs,
  indexMaps,
  indexRowFor,
  refFor,
  zipItems,
  type VaultIndexRow,
} from '@/views/vault/vault-files';
import { useVaultActions } from '@/views/vault/use-vault-actions';
import { VaultUploadDialog } from '@/views/vault/VaultUploadDialog';
import { VaultRequestsSection } from '@/views/vault/VaultRequestsSection';
import type { VaultDocument } from '@/lib/documents/vault-documents';

/*
 * Staff Vault (K-39): the client Documents explorer look with the client dropdown first. One
 * card holds the toolbar (client, filter, By step / By category), the tree on the left and the
 * preview pane on the right. The data is the same as before: checklist uploads merged with the
 * indexed documents, scoped to the engagements the signed-in person can see.
 */

/** Plain page head (R-02): title and the counts, with the shell back chevron beside the title. */
function VaultHead({ meta }: { meta?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <PageBackCluster className="min-w-0 flex-[1_1_240px]">
        <div className="min-w-0">
          <h1 className="text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">Vault</h1>
          {meta ? <p className="text-[13.5px] tabular-nums text-ink-muted">{meta}</p> : null}
        </div>
      </PageBackCluster>
    </div>
  );
}

export default function DocumentVaultPage() {
  return (
    <Suspense fallback={<VaultPageSkeleton path="/app/intern/vault" />}>
      <DocumentVaultPageContent />
    </Suspense>
  );
}

/** R-48: loading shows grey shapes in the explorer's place. */
function VaultPageSkeleton({ path }: { path: string }) {
  return (
    <PageTransition>
      <SEO title="Document Vault — VCFO Suite" description="Central evidence repository for GCC setup projects." path={path} />
      <VaultHead />
      <section className="surface overflow-hidden" aria-busy="true" aria-label="Loading documents">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2.5">
          <span className="block h-9 w-[200px] animate-pulse rounded-md bg-surface-sunken" />
          <span className="block h-9 w-[220px] animate-pulse rounded-md bg-surface-sunken" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[440px_minmax(0,1fr)]">
          <SkeletonRows rows={7} className="p-3 md:border-r md:border-line-soft" />
          <div className="hidden min-h-[320px] animate-pulse bg-surface-sunken md:block" aria-hidden />
        </div>
      </section>
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
  const [view, setView] = useState<VaultTreeView>('step');
  /** Folders the person has collapsed. Every folder starts open. */
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  /** Files ticked for a ZIP of the selection (G-26). */
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const actions = useVaultActions();

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

  // The index rows carry the review state and the content type; a checklist upload a staff member
  // made has one too, matched by its object key.
  const index = useMemo(() => indexMaps((indexedQuery.data ?? []) as VaultIndexRow[]), [indexedQuery.data]);
  const indexFor = (doc: VaultDocument) => indexRowFor(doc, index.byKey, index.byId);

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

  // The dropdown lists every client; the filter narrows the files, not the client list.
  const selectedEntityId =
    (activeEntityId && entityGroups.some((g) => g.engagementId === activeEntityId)
      ? activeEntityId
      : null) ??
    entityGroups[0]?.engagementId ??
    null;
  const selectedEntity = entityGroups.find((g) => g.engagementId === selectedEntityId) ?? null;

  const treeRows = useMemo(
    () => (selectedEntity ? buildVaultTree(selectedEntity, view, closed) : []),
    [selectedEntity, view, closed],
  );

  // While filtering, the tree shows every matching file across the clients the person can see,
  // as the old search did, so a link from the command palette (?q=) still finds the file.
  const visibleDocs = isSearching
    ? searchHits.map((h) => h.doc)
    : treeRows.flatMap((r) => (r.kind === 'file' ? [r.doc] : []));
  const entityDocs = useMemo(
    () => (selectedEntity ? selectedEntity.milestones.flatMap((m) => m.sections.flatMap((s) => s.docs)) : []),
    [selectedEntity],
  );
  const pool = isSearching ? searchHits.map((h) => h.doc) : entityDocs;
  const selectedDoc =
    pool.find((d) => d.id === selectedDocId) ?? visibleDocs[0] ?? pool[0] ?? null;

  const projectHref = (engagementId: string, slug?: string) => {
    const target = { id: engagementId, slug };
    return isIntern ? internEngagementPath(target) : adminProjectPath(target, staffBase);
  };

  function setChecked(id: string, on: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function zipDocs(name: string, docs: VaultDocument[]) {
    void actions.downloadZip(name, zipItems(docs, (d) => indexFor(d)?.id));
  }

  function toggleFolder(id: string) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (engagementsLoading || checklistRefreshing) {
    return <VaultPageSkeleton path={vaultPath} />;
  }

  const clientWord = isIntern ? 'client' : 'entity';
  const clientWords = isIntern ? 'clients' : 'entities';
  const meta = `${allDocs.length} ${allDocs.length === 1 ? 'document' : 'documents'} · ${entityGroups.length} ${entityGroups.length === 1 ? clientWord : clientWords}`;

  let treeBody: ReactNode;
  if (isSearching) {
    treeBody =
      searchHits.length === 0 ? (
        <div className="p-3">
          <EmptyState
            title={`No document matches “${q.trim()}”`}
            action={
              <Button type="button" size="sm" variant="secondary" onClick={() => setQ('')}>
                Clear filter
              </Button>
            }
          />
        </div>
      ) : (
        searchHits.map((hit) => (
          <VaultFileRow
            key={hit.doc.id}
            doc={hit.doc}
            depth={0}
            selected={selectedDoc?.id === hit.doc.id}
            sub={`${hit.companyName} · ${hit.location}`}
            onSelect={() => setSelectedDocId(hit.doc.id)}
          />
        ))
      );
  } else if (!selectedEntity || selectedEntity.docCount === 0) {
    treeBody = (
      <div className="p-3">
        <EmptyState title="No files for this client yet" />
      </div>
    );
  } else {
    treeBody = treeRows.map((row) =>
      row.kind === 'folder' ? (
        <VaultFolderRow
          key={row.id}
          label={row.label}
          depth={row.depth}
          count={row.count}
          open={!closed.has(row.id)}
          onToggle={() => toggleFolder(row.id)}
          onZip={() => zipDocs(`${selectedEntity.companyName} ${row.label}`, folderDocs(selectedEntity, view, row.id))}
        />
      ) : (
        <VaultFileRow
          key={row.id}
          doc={row.doc}
          depth={row.depth}
          tag={row.tag}
          sub={row.sub}
          selected={selectedDoc?.id === row.doc.id}
          onSelect={() => setSelectedDocId(row.doc.id)}
          checked={checkedIds.has(row.doc.id)}
          onCheck={(on) => setChecked(row.doc.id, on)}
          reviewStatus={indexFor(row.doc)?.reviewStatus}
        />
      ),
    );
  }

  const checkedDocs = selectedEntity ? allEntityDocs(selectedEntity).filter((d) => checkedIds.has(d.id)) : [];
  const selectedIndex = selectedDoc ? indexFor(selectedDoc) : null;
  const selectedRef = selectedDoc ? refFor(selectedDoc, selectedIndex?.id) : null;
  const reviewRef =
    selectedRef && ('documentId' in selectedRef || 'path' in selectedRef) ? selectedRef : null;

  return (
    <PageTransition>
      <SEO
        title="Document Vault — VCFO Suite"
        description="Submitted documents organized by company, checklist step, and section."
        path={vaultPath}
      />

      <VaultHead meta={entityGroups.length > 0 ? meta : undefined} />

      {entityGroups.length === 0 && !isSearching ? (
        <EmptyState
          title={isIntern ? 'No clients assigned yet' : 'No submitted documents yet'}
          action={
            <Button type="button" size="sm" onClick={() => router.push(portfolioHref)}>
              {portfolioLabel}
            </Button>
          }
        />
      ) : (
        <section aria-label="Documents" className="surface min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2.5">
            <Select
              value={selectedEntityId ?? undefined}
              onValueChange={(id) => {
                setActiveEntityId(id);
                setSelectedDocId(null);
                setCheckedIds(new Set());
              }}
            >
              <SelectTrigger
                aria-label={isIntern ? 'Client' : 'Entity'}
                className="h-9 w-full min-w-0 sm:w-[240px]"
              >
                <span className="truncate">{selectedEntity?.companyName ?? (isIntern ? 'Client' : 'Entity')}</span>
              </SelectTrigger>
              <SelectContent>
                {entityGroups.map((entity) => (
                  <SelectItem key={entity.engagementId} value={entity.engagementId}>
                    {entity.companyName} · {entity.docCount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex h-9 min-w-[140px] flex-1 items-center gap-2 rounded-md border-1.5 border-line-strong bg-surface-raised px-2.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-line sm:w-[240px] sm:flex-none">
              <Search className="h-[15px] w-[15px] flex-none text-ink-muted" strokeWidth={1.6} aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter documents"
                aria-label="Filter documents"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint"
              />
              <span className="flex-none text-[12.5px] tabular-nums text-ink-muted">
                {isSearching ? `${searchHits.length}/${allDocs.length}` : selectedEntity?.docCount ?? 0}
              </span>
            </label>

            {isSearching ? null : (
              <SpectrumTabs
                label="Group documents"
                items={[
                  { key: 'step', label: 'By step' },
                  { key: 'cat', label: 'By category' },
                ]}
                value={view}
                onChange={(v) => setView(v as VaultTreeView)}
              />
            )}

            {selectedEntity && !isSearching ? (
              <span className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={actions.zipping || selectedEntity.docCount === 0}
                  onClick={() =>
                    checkedDocs.length > 0
                      ? zipDocs(`${selectedEntity.companyName} selection`, checkedDocs)
                      : zipDocs(`${selectedEntity.companyName} documents`, allEntityDocs(selectedEntity))
                  }
                  aria-label={checkedDocs.length > 0 ? `Download ${checkedDocs.length} selected (ZIP)` : 'Download all (ZIP)'}
                  title={checkedDocs.length > 0 ? `Download ${checkedDocs.length} selected (ZIP)` : 'Download all (ZIP)'}
                >
                  <Download aria-hidden />
                  {checkedDocs.length > 0 ? `${checkedDocs.length} selected` : 'Download all'}
                </Button>
                {checkedDocs.length > 0 ? (
                  <Button type="button" size="sm" variant="quiet" onClick={() => setCheckedIds(new Set())}>
                    Clear
                  </Button>
                ) : null}
                <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload aria-hidden /> Upload
                </Button>
              </span>
            ) : null}

            {selectedEntity && !isSearching ? (
              <Button asChild size="sm" variant="secondary">
                <Link
                  href={projectHref(
                    selectedEntity.engagementId,
                    selectedEntity.slug ??
                      engagements.find((e) => e.id === selectedEntity.engagementId)?.slug,
                  )}
                >
                  {isIntern ? 'Open client' : 'Open project'}
                  <ArrowUpRight aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>

          {/* The filter searches every client, so the line names how many files and clients match. */}
          {isSearching && filteredGroups.length > 0 ? (
            <p className="border-b border-line-soft px-4 py-2 text-[12.5px] text-ink-muted">
              {searchHits.length} {searchHits.length === 1 ? 'file' : 'files'} in{' '}
              {filteredGroups.length} {filteredGroups.length === 1 ? clientWord : clientWords}
            </p>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[440px_minmax(0,1fr)]">
            <div role="tree" aria-label="Folders and files" className="min-w-0 py-2 md:border-r md:border-line-soft">
              {treeBody}
            </div>
            <aside className="min-w-0 border-t border-line-soft md:border-t-0" aria-label="Preview">
              {selectedDoc ? (
                <VaultPreviewPane
                  doc={selectedDoc}
                  fileRef={selectedRef}
                  contentType={selectedIndex?.contentType}
                  review={
                    selectedIndex
                      ? {
                          status: selectedIndex.reviewStatus ?? 'none',
                          note: selectedIndex.reviewNote ?? null,
                          reviewedAt: selectedIndex.reviewedAt ?? null,
                        }
                      : null
                  }
                  onReview={reviewRef ? (status, note) => actions.review(reviewRef, status, note) : undefined}
                />
              ) : (
                <div className="grid h-full min-h-[240px] place-items-center bg-surface-sunken p-5 text-[13px] text-ink-faint">
                  —
                </div>
              )}
            </aside>
          </div>
        </section>
      )}

      {selectedEntity && !isSearching ? (
        <>
          <VaultRequestsSection
            key={selectedEntity.engagementId}
            engagementId={selectedEntity.engagementId}
            companyName={selectedEntity.companyName}
            onZip={(name, items) => void actions.downloadZip(name, items)}
            zipping={actions.zipping}
          />
          <VaultUploadDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            engagementId={selectedEntity.engagementId}
            companyName={selectedEntity.companyName}
            onUploaded={() => void actions.refreshIndex()}
          />
        </>
      ) : null}
    </PageTransition>
  );
}
