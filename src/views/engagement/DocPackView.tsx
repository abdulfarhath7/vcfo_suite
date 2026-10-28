'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { Archive } from 'lucide-react';

import { HexgridLoader } from '@/components/common/HexgridLoader';
import { DocPackPreviewDialog } from '@/components/doc-pack/DocPackPreviewDialog';
import { DocPackRow } from '@/components/doc-pack/DocPackRow';
import { DocStatusDot } from '@/components/doc-pack/DocStatusChip';
import { EmptyStateIllustrated } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { useApp } from '@/context/AppContext';
import { useDocPack } from '@/hooks/use-doc-pack';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import {
  DOC_PACK_PART_PARAM,
  docPackItemUrl,
  docPackStepPath,
  docPackZipUrl,
  parseDocPart,
  type DocPackShell,
} from '@/lib/doc-pack/paths';
import type { DocPackItem, DocPart, DocStatus } from '@/lib/doc-pack/types';
import { isInternEngagementPathname } from '@/lib/projects/project-step-path';
import { engagementRouteParamFromParams, resolveEngagementFromRouteParam } from '@/lib/slug';

type PartFilter = 'all' | DocPart;

const PART_LABEL: Record<PartFilter, string> = {
  all: 'All',
  'part-a': 'SPICe+ Part A',
  'part-b': 'SPICe+ Part B',
};

const STAT_LABEL: Record<DocStatus, string> = {
  ready: 'ready',
  'needs-inputs': 'need inputs',
  'waiting-release': 'waiting for release',
};

/**
 * The one place that previews and downloads generated pre-incorporation
 * documents. Staff only; the API answers 403 to clients and the shells never
 * link here for them. Shared by the lead, manager and admin routes.
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
  const [previewItem, setPreviewItem] = useState<DocPackItem | null>(null);

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
  const readyCount = summary?.counts.ready ?? 0;

  const hrefForStep = (stepId: string, tabId?: string) => docPackStepPath(eng, shell, stepId, tabId);

  return (
    <PageTransition>
      <SEO
        title={`Pre-incorporation documents — ${eng.companyName}`}
        description="Readiness, preview and download of the SPICe+ document pack."
        path={pathname}
      />

      {/* Plain head (prototype `DocumentPackScreen`): 28px title, the counts in a muted line,
          the one main button on the right. No back link (R-09). */}
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-[1_1_280px]">
          <h1 className="text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">Pre-incorporation documents</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-ink-muted">
            <span>{eng.companyName}</span>
            {summary
              ? (['ready', 'needs-inputs', 'waiting-release'] as const).map((status) => (
                  <span key={status} className="inline-flex items-center gap-1.5">
                    <DocStatusDot status={status} />
                    <b className="font-medium tabular-nums text-ink">{summary.counts[status]}</b> {STAT_LABEL[status]}
                  </span>
                ))
              : null}
          </p>
        </div>
        {summary ? (
          readyCount > 0 ? (
            <Button asChild>
              <a href={docPackZipUrl(eng.id)} download>
                <Archive strokeWidth={1.6} aria-hidden />
                Download ready ({readyCount}) as .zip
              </a>
            </Button>
          ) : (
            <Button type="button" disabled title="Nothing is ready to download yet">
              <Archive strokeWidth={1.6} aria-hidden />
              Download ready (0) as .zip
            </Button>
          )
        ) : null}
      </header>

      {pack.isError ? (
        <EmptyStateIllustrated
          title="Could not load the document pack"
          description={pack.error instanceof Error ? pack.error.message : 'The readiness check failed.'}
          actionLabel="Try again"
          onAction={() => void pack.refetch()}
          art="waiting"
        />
      ) : !summary ? (
        <div className="flex justify-center py-16" aria-busy="true" aria-live="polite">
          <HexgridLoader size="sm" />
        </div>
      ) : (
        <>
          <section className="surface min-w-0 overflow-hidden">
            <div className="flex min-h-[52px] min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line-soft px-4 py-2">
              <CardHeadTile title="Documents" />
              <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Documents</h2>
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
            </div>
            {items.length === 0 ? (
              <EmptyState title="No documents in this part" className="m-4" />
            ) : (
              <ul className="list-none">
                {items.map((item) => (
                  <DocPackRow
                    key={item.key}
                    item={item}
                    downloadUrl={docPackItemUrl(eng.id, item.key)}
                    hrefForMissing={(input) => hrefForStep(input.stepId, input.tabId)}
                    hrefForStep={(stepId) => hrefForStep(stepId)}
                    onPreview={setPreviewItem}
                  />
                ))}
              </ul>
            )}
          </section>

          {summary.skippedDirectors.length > 0 ? (
            <p className="mt-3 text-[12.5px] text-ink-muted">
              Not in the pack yet: {summary.skippedDirectors.map((d) => d.displayName).join(', ')}.{' '}
              {summary.skippedDirectors[0]?.reason}.{' '}
              <Link href={hrefForStep('pre-15')} className="text-brand-text hover:underline">
                Proposed Directors
              </Link>
            </p>
          ) : null}
        </>
      )}

      <DocPackPreviewDialog
        item={previewItem}
        previewUrl={previewItem ? docPackItemUrl(eng.id, previewItem.key, true) : null}
        onClose={() => setPreviewItem(null)}
      />
    </PageTransition>
  );
}
