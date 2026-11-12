'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';

import { HexgridLoader } from '@/components/common/HexgridLoader';
import { DocPackPreviewDialog } from '@/components/doc-pack/DocPackPreviewDialog';
import { DocPackPreviewPanel } from '@/components/doc-pack/DocPackPreviewPanel';
import { DocPackRow } from '@/components/doc-pack/DocPackRow';
import { DOC_STATUS_TAG_TONE } from '@/components/doc-pack/DocStatusChip';
import { EmptyStateIllustrated } from '@/components/noir';
import { DownloadDocumentsButton } from '@/components/document-downloads/DownloadDocumentsDialog';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { Tag } from '@/components/ui/spectrum-chip';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { useApp } from '@/context/AppContext';
import { useDocPack } from '@/hooks/use-doc-pack';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import {
  DOC_PACK_PART_PARAM,
  docPackItemUrl,
  docPackStepPath,
  parseDocPart,
  type DocPackShell,
} from '@/lib/doc-pack/paths';
import type { DocPackItem, DocPart, DocStatus } from '@/lib/doc-pack/types';
import { cn } from '@/lib/utils';
import { isInternEngagementPathname } from '@/lib/projects/project-step-path';
import { engagementRouteParamFromParams, resolveEngagementFromRouteParam } from '@/lib/slug';

type PartFilter = 'all' | DocPart;

const PART_LABEL: Record<PartFilter, string> = {
  all: 'All',
  'part-a': 'SPICe+ Part A',
  'part-b': 'SPICe+ Part B',
};

interface DocGroup {
  key: string;
  /** "Director 1", or "Company documents". */
  title: string;
  /** The director's name, shown after the title. */
  name?: string;
  /** "Outside India" / "Resident in India" for a director. */
  note?: string;
  items: DocPackItem[];
}

/**
 * The documents of one part, under each director's name in director order (DIR-2, DIR-8, INC-9 …
 * as a tree, owner's sketch of 12 November 2026), then the company's own documents.
 */
function groupByDirector(items: DocPackItem[]): DocGroup[] {
  const directors = new Map<string, DocGroup & { order: number }>();
  const company: DocPackItem[] = [];
  for (const item of items) {
    if (item.audience === 'company') {
      company.push(item);
      continue;
    }
    const key = item.audience;
    let group = directors.get(key);
    if (!group) {
      group = {
        key,
        title: '',
        name: item.directorName,
        note: key.startsWith('non-resident') ? 'Outside India' : 'Resident in India',
        items: [],
        order: item.directorIndex ?? Number.MAX_SAFE_INTEGER,
      };
      directors.set(key, group);
    }
    group.items.push(item);
  }
  const ordered = [...directors.values()].sort((a, b) => a.order - b.order);
  const groups: DocGroup[] = ordered.map((group, i) => ({ ...group, title: `Director ${i + 1}` }));
  if (company.length > 0) groups.push({ key: 'company', title: 'Company documents', items: company });
  return groups;
}

const STAT_LABEL: Record<DocStatus, string> = {
  ready: 'ready',
  'needs-inputs': 'need inputs',
  'waiting-release': 'waiting for release',
};

/**
 * The one place that previews and downloads generated pre-incorporation
 * documents. Staff only; the API answers 403 to clients and the shells never
 * link here for them. Shared by the lead, manager and admin routes.
 *
 * VCFO Spectrum (prototype `DocumentPackScreen`): a plain head with the count tags and the zip
 * button, the part switch above the list, one card with a grey band per part, and the preview
 * card that is always open (380px from xl, under the list below xl).
 */
export default function DocPackView() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { engagements, engagementsSettled } = useApp();
  const staffBase = useStaffBasePath();

  const shell: DocPackShell = isInternEngagementPathname(pathname) ? 'intern' : staffBase;
  const engagementParam = engagementRouteParamFromParams(params as Record<string, string | string[] | undefined>);
  const eng = useMemo(
    () => resolveEngagementFromRouteParam(engagements, engagementParam),
    [engagements, engagementParam],
  );

  const [part, setPart] = useState<PartFilter>(
    () => parseDocPart(searchParams.get(DOC_PACK_PART_PARAM)) ?? 'all',
  );
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [largeItem, setLargeItem] = useState<DocPackItem | null>(null);
  const pack = useDocPack(eng?.id);

  if (!eng) {
    return (
      <PageTransition>
        {engagementsSettled ? (
          <EmptyStateIllustrated
            title="Project not found"
            description="This project is not in your list, or the link is out of date."
            art="empty"
          />
        ) : (
          <div className="flex justify-center py-16">
            <HexgridLoader size="sm" />
          </div>
        )}
      </PageTransition>
    );
  }

  const summary = pack.data;
  const items = summary?.items.filter((item) => part === 'all' || item.part === part) ?? [];
  const countFor = (filter: PartFilter) =>
    summary ? summary.items.filter((item) => filter === 'all' || item.part === filter).length : 0;
  const parts = (['part-a', 'part-b'] as const)
    .filter((key) => part === 'all' || key === part)
    .map((key) => ({ key, items: items.filter((item) => item.part === key) }))
    .filter((group) => group.items.length > 0);
  // The picked row, else the first ready document, else the first document.
  const picked =
    summary?.items.find((item) => item.key === pickedKey) ??
    summary?.items.find((item) => item.status === 'ready') ??
    summary?.items[0] ??
    null;

  const hrefForStep = (stepId: string, tabId?: string) => docPackStepPath(eng, shell, stepId, tabId);
  const pickedStep = picked ? picked.missing[0]?.stepId ?? picked.sourceStepIds[0] ?? null : null;

  return (
    <PageTransition>
      <SEO
        title={`Incorporation Documents — ${eng.companyName}`}
        description="Readiness, preview and download of the incorporation documents, director by director."
        path={pathname}
      />

      {/* Plain head (prototype `DocumentPackScreen`): 28px title, the company and the count tags,
          the one main button on the right. No back link (R-09). */}
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-[1_1_260px]">
          <h1 className="text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">Incorporation Documents</h1>
          <p className="flex flex-wrap items-center gap-1.5 pt-1 text-[13.5px] text-ink-muted">
            {summary
              ? (['ready', 'needs-inputs', 'waiting-release'] as const).map((status) => (
                  <Tag key={status} tone={DOC_STATUS_TAG_TONE[status]}>
                    {summary.counts[status]} {STAT_LABEL[status]}
                  </Tag>
                ))
              : null}
          </p>
        </div>
        {/* CR-2026-11: one pop-up picks any set of documents, uploads included. */}
        <DownloadDocumentsButton engagementId={eng.id} />
      </header>

      {pack.isError ? (
        <EmptyStateIllustrated
          title="Could not load the incorporation documents"
          description={pack.error instanceof Error ? pack.error.message : 'The readiness check failed.'}
          actionLabel="Try again"
          onAction={() => void pack.refetch()}
          art="waiting"
        />
      ) : !summary ? (
        <section className="surface min-w-0 overflow-hidden p-4" aria-busy="true" aria-live="polite" aria-label="Incorporation Documents">
          <SkeletonRows rows={6} />
        </section>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <SpectrumTabs
              label="Filter by part"
              items={(['all', 'part-a', 'part-b'] as const).map((filter) => ({
                key: filter,
                label: PART_LABEL[filter],
                count: countFor(filter),
              }))}
              value={part}
              onChange={(k) => setPart(k as PartFilter)}
            />
            {summary.skippedDirectors.length > 0 ? (
              <Link
                href={hrefForStep('pre-15')}
                title={summary.skippedDirectors[0]?.reason}
                className="text-[13px] font-medium text-brand-text hover:underline"
              >
                Not in the pack yet: {summary.skippedDirectors.map((d) => d.displayName).join(', ')} →
              </Link>
            ) : null}
          </div>

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="surface min-w-0 overflow-hidden" aria-label="Incorporation Documents">
              {parts.length === 0 ? (
                <EmptyState title="No documents in this part" className="m-4" />
              ) : (
                parts.map((group, index) => {
                  const done = group.items.filter((item) => item.status === 'ready').length;
                  const pct = group.items.length > 0 ? (done / group.items.length) * 100 : 0;
                  return (
                    <div key={group.key}>
                      <div
                        className={cn(
                          'flex items-center gap-2.5 bg-surface-sunken px-4 py-2.5 md:px-5',
                          index > 0 && 'border-t-1.5 border-line',
                        )}
                      >
                        <b className="text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-2">{PART_LABEL[group.key]}</b>
                        <span
                          className="relative block h-2 max-w-[160px] flex-1 overflow-hidden rounded-bar bg-surface-raised"
                          role="img"
                          aria-label={`${done} of ${group.items.length} ready`}
                        >
                          {done > 0 ? <i className="absolute inset-y-0 left-0 rounded-bar bg-positive-mid" style={{ width: `${pct}%` }} /> : null}
                        </span>
                        <span className="text-[12.5px] tabular-nums text-ink-muted">
                          {done} of {group.items.length}
                        </span>
                      </div>
                      {groupByDirector(group.items).map((sub) => (
                        <div key={sub.key} className="border-t border-line-soft">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 pb-1 pt-3 md:px-5">
                            <span className="font-mono text-[12px] uppercase tracking-[.05em] text-ink-muted">{sub.title}</span>
                            {sub.name ? <b className="text-[15px] font-semibold text-ink">{sub.name}</b> : null}
                            {sub.note ? <span className="text-[12.5px] text-ink-muted">· {sub.note}</span> : null}
                          </div>
                          {/* A tree under the heading: one vertical line, a short branch to each document. */}
                          <ul
                            className={cn(
                              'relative mb-2 ml-6 list-none border-l-[1.5px] border-line-strong md:ml-7',
                              "[&>li]:relative [&>li]:border-t-0 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-1/2 [&>li]:before:h-[1.5px] [&>li]:before:w-3 [&>li]:before:bg-line-strong [&>li]:before:content-['']",
                            )}
                          >
                            {sub.items.map((item) => (
                              <DocPackRow
                                key={item.key}
                                item={item}
                                picked={picked?.key === item.key}
                                downloadUrl={docPackItemUrl(eng.id, item.key)}
                                onPreview={(next) => setPickedKey(next.key)}
                                hideDirector={sub.key !== 'company'}
                              />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </section>

            <DocPackPreviewPanel
              className="xl:sticky xl:top-[var(--shell-sticky-top)]"
              item={picked}
              previewUrl={picked ? docPackItemUrl(eng.id, picked.key, true) : null}
              downloadUrl={picked ? docPackItemUrl(eng.id, picked.key) : null}
              stepHref={pickedStep ? hrefForStep(pickedStep) : null}
              onExpand={picked ? () => setLargeItem(picked) : undefined}
            />
          </div>
        </>
      )}

      <DocPackPreviewDialog
        item={largeItem}
        previewUrl={largeItem ? docPackItemUrl(eng.id, largeItem.key, true) : null}
        onClose={() => setLargeItem(null)}
      />
    </PageTransition>
  );
}
