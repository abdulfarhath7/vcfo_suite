'use client';

import Link from 'next/link';
import { m, useReducedMotion } from 'framer-motion';
import { FileBadge, FileText, IdCard, ScrollText, type LucideIcon } from 'lucide-react';
import { Mono } from '@/components/noir';
import { ClientCard } from '@/components/client/overview/ClientCard';
import { GeometricEmpty } from '@/components/illustrations/GeometricEmpty';
import { MilestoneDocumentLink } from '@/components/common/MilestoneDocumentLink';
import type { ClientOverviewDocuments } from '@/lib/client-overview';
import { formatClientDate } from '@/components/client/overview/client-overview-format';
import { ease } from '@/lib/motion';

const KIND_ICON: Record<string, LucideIcon> = {
  certificate: FileBadge,
  card: IdCard,
  constitution: ScrollText,
};

/**
 * Module 8 — firm-issued deliverables, plus the document-status donut.
 *
 * Only the curated certificate set reaches here (see `CLIENT_DELIVERABLE_FIELDS`),
 * so a board-resolution draft can never appear. Every tile resolves a real
 * signed URL through the existing milestone-document route.
 */
export function ClientDeliverables({ documents }: { documents: ClientOverviewDocuments }) {
  const { deliverables, counts } = documents;
  const reduceMotion = useReducedMotion();

  return (
    <ClientCard
      title="Your documents"
      icon={FileText}
      tone="cyan"
      action={
        <Link
          href="/app/client/documents"
          className="text-[11.5px] font-bold text-primary hover:underline"
        >
          All documents
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          {deliverables.length === 0 ? (
            <div className="flex flex-col items-center rounded-[var(--radius)] border border-dashed border-primary/20 bg-primary-light/30 px-6 py-7 text-center">
              <GeometricEmpty variant="waiting" />
              <p className="serif mt-2 text-[1.05rem] text-ink">No certificates issued yet</p>
              <p className="prose-narrow mt-1.5 text-[12px] text-muted-foreground">
                Your Certificate of Incorporation, PAN, TAN, and registration
                certificates will land here as they are issued.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {deliverables.map((doc, index) => {
                const Icon = KIND_ICON[doc.kind] ?? FileText;
                return (
                  <m.li
                    key={doc.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * index, duration: 0.24, ease }}
                    className="min-w-0"
                  >
                    <div className="client-doc-tile h-full">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[oklch(var(--phase-filing-soft))] text-[oklch(var(--phase-filing-text))]">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-extrabold text-ink">{doc.name}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {doc.issuedAt && (
                            <Mono className="text-[10.5px] tabular-nums text-muted-foreground">
                              {formatClientDate(doc.issuedAt)}
                            </Mono>
                          )}
                          <MilestoneDocumentLink
                            storagePath={doc.storagePath}
                            label={doc.name}
                            variant="client"
                            className="min-h-0 text-[11.5px] text-primary"
                          />
                        </div>
                      </div>
                    </div>
                  </m.li>
                );
              })}
            </ul>
          )}
        </div>

        <DocStatusDonut counts={counts} reduceMotion={Boolean(reduceMotion)} />
      </div>
    </ClientCard>
  );
}

/**
 * Three slices, well under the six-slice ceiling. "Still needed" deliberately
 * uses the quiet sky wash rather than `--warning`: coral is a chip colour in
 * this system (see the palette note in globals.css), and a brand-new client
 * whose only row is one pending request should not meet an alarm-coloured ring.
 */
const DONUT_SEGMENTS = [
  { key: 'delivered', label: 'Issued to you', fill: 'oklch(var(--primary))' },
  { key: 'submitted', label: 'Received from you', fill: 'oklch(var(--phase-post))' },
  { key: 'requested', label: 'Still needed', fill: 'oklch(var(--phase-pre))' },
] as const;

/** Renders an honest empty ring rather than a fabricated series when nothing exists yet. */
function DocStatusDonut({
  counts,
  reduceMotion,
}: {
  counts: ClientOverviewDocuments['counts'];
  reduceMotion: boolean;
}) {
  const values = {
    delivered: counts.delivered,
    submitted: counts.submitted,
    requested: counts.requested,
  };
  const total = values.delivered + values.submitted + values.requested;

  const size = 112;
  const thickness = 11;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = DONUT_SEGMENTS.map((segment) => {
    const value = values[segment.key];
    const length = total === 0 ? 0 : (value / total) * circumference;
    const arc = {
      ...segment,
      value,
      dash: `${length} ${circumference - length}`,
      offset: -offset,
    };
    offset += length;
    return arc;
  });

  return (
    <figure className="flex min-w-0 items-center gap-3 lg:flex-col lg:items-start lg:gap-2.5">
      <div className="relative inline-flex shrink-0 items-center justify-center">
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="oklch(var(--raised))"
            strokeWidth={thickness}
          />
          {total > 0 &&
            arcs.map((arc, index) => (
              <m.circle
                key={arc.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.fill}
                strokeWidth={thickness}
                strokeLinecap="butt"
                strokeDasharray={arc.dash}
                strokeDashoffset={arc.offset}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.12 + index * 0.1, duration: 0.5, ease }}
              />
            ))}
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="serif text-[1.35rem] font-bold leading-none tabular-nums text-ink">
            {total}
          </span>
          <span className="mt-0.5 text-[8.5px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
            {total === 1 ? 'document' : 'documents'}
          </span>
        </div>
      </div>

      {/* Legend beside the ring, same as the lead dashboard's compliance donut. */}
      <figcaption className="flex min-w-0 flex-1 flex-col gap-1.5 text-[12px] font-bold text-muted-foreground lg:w-full lg:flex-none">
        {arcs.map((arc) => (
          <span key={arc.key} className="flex min-w-0 items-center gap-2">
            <i
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: arc.fill }}
              aria-hidden
            />
            <span className="min-w-0 truncate">{arc.label}</span>
            <span className="mono ml-auto tabular-nums text-ink">{arc.value}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
