'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { Archive } from 'lucide-react';

import { HexgridLoader } from '@/components/common/HexgridLoader';
import { DocPackPreviewDialog } from '@/components/doc-pack/DocPackPreviewDialog';
import { DocPackRow } from '@/components/doc-pack/DocPackRow';
import { DocStatusDot } from '@/components/doc-pack/DocStatusChip';
import { AccentButton, EmptyStateIllustrated, Surface } from '@/components/noir';
import { PageBackButton } from '@/components/shell/PageBackButton';
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
import { isInternEngagementPathname } from '@/lib/project-step-path';
import { engagementRouteParamFromParams, resolveEngagementFromRouteParam } from '@/lib/slug';
import { cn } from '@/lib/utils';

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

      <div className="mb-5">
        <div className="flex min-w-0 items-center gap-1.5">
          <PageBackButton className="-ml-1.5" />
          <h1 className="serif min-w-0 text-[22px] leading-tight tracking-tight text-foreground">
            Pre-incorporation documents
          </h1>
        </div>
        <p className="mt-1 pl-8 text-[13px] text-muted-foreground">
          {eng.companyName}. Generated from SPICe+ Part A and Part B. Regenerates on every download unless a
          version was attached to Pre-7.
        </p>
      </div>

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
          <Surface className="mb-4 flex flex-wrap items-center gap-2.5 px-5 py-4">
            {(['ready', 'needs-inputs', 'waiting-release'] as const).map((status) => (
              <span
                key={status}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px]',
                  status === 'ready' && 'bg-success-light text-success-text',
                  status === 'needs-inputs' && 'bg-warning-light text-warning-text',
                  status === 'waiting-release' && 'bg-muted text-muted-foreground',
                )}
              >
                <DocStatusDot status={status} />
                <b className="font-semibold">{summary.counts[status]}</b> {STAT_LABEL[status]}
              </span>
            ))}
            <div className="ml-auto">
              {readyCount > 0 ? (
                <a
                  href={docPackZipUrl(eng.id)}
                  download
                  className="inline-flex h-10 min-h-[44px] items-center rounded-md border border-border bg-panel px-4 text-sm font-medium text-primary hover:border-primary/35 hover:bg-primary-light sm:min-h-10"
                >
                  <Archive className="mr-2 h-4 w-4" aria-hidden />
                  Download ready ({readyCount}) as .zip
                </a>
              ) : (
                <AccentButton type="button" variant="outline" disabled title="Nothing is ready to download yet">
                  <Archive className="mr-2 h-4 w-4" aria-hidden />
                  Download ready (0) as .zip
                </AccentButton>
              )}
            </div>
          </Surface>

          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by part">
            {(['all', 'part-a', 'part-b'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={part === filter}
                onClick={() => setPart(filter)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
                  part === filter
                    ? 'border-primary bg-primary-light font-semibold text-primary'
                    : 'border-border bg-panel text-muted-foreground hover:bg-muted/40',
                )}
              >
                {PART_LABEL[filter]} ({countFor(filter)})
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <EmptyStateIllustrated
              title="No documents in this part"
              description="Switch the filter to see the rest of the pack."
              art="empty"
            />
          ) : (
            <Surface className="overflow-hidden p-0">
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
            </Surface>
          )}

          {summary.skippedDirectors.length > 0 ? (
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              Not in the pack yet: {summary.skippedDirectors.map((d) => d.displayName).join(', ')}.{' '}
              {summary.skippedDirectors[0]?.reason}.{' '}
              <Link href={hrefForStep('pre-15')} className="text-primary hover:underline">
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
