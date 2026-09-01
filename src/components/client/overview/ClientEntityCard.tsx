'use client';

import { BadgeCheck } from 'lucide-react';
import { Mono } from '@/components/noir';
import type { ClientOverviewEngagement, ClientOverviewIdentifiers } from '@/lib/client-overview';
import {
  LEGAL_FORM_LABEL,
  formatClientDate,
} from '@/components/client/overview/client-overview-format';

/**
 * Module 9 — the entity ID card. Post-COI only.
 *
 * A screenshot-able trust artifact: statutory identifiers in mono, laid out the
 * way a passport data page reads. Purely informational — no actions.
 */
export function ClientEntityCard({
  engagement,
  identifiers,
}: {
  engagement: ClientOverviewEngagement;
  identifiers: ClientOverviewIdentifiers;
}) {
  const rows = [
    { label: 'CIN', value: identifiers.cin },
    { label: 'PAN', value: identifiers.pan },
    { label: 'TAN', value: identifiers.tan },
    { label: 'PF code', value: identifiers.pfCode },
    { label: 'ESI code', value: identifiers.esiCode },
  ].filter((row) => Boolean(row.value));

  if (rows.length === 0 && !engagement.incorporationDate) return null;

  return (
    <section className="client-idcard px-4 pb-4 pt-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-muted-foreground">
            Registered entity
          </p>
          <h2 className="serif mt-1.5 break-words text-[1.3rem] leading-tight tracking-tight text-ink">
            {engagement.companyName}
          </h2>
          <p className="mt-1 text-[11.5px] font-semibold text-muted-foreground">
            {LEGAL_FORM_LABEL[engagement.legalForm]}
            {engagement.parentEntityName ? ` · subsidiary of ${engagement.parentEntityName}` : ''}
          </p>
        </div>
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-light px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-success-text"
          title="Incorporated with the Ministry of Corporate Affairs"
        >
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          Incorporated
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
        {engagement.incorporationDate && (
          <IdField label="Date of incorporation" value={formatClientDate(engagement.incorporationDate)} />
        )}
        {rows.map((row) => (
          <IdField key={row.label} label={row.label} value={row.value!} />
        ))}
      </dl>

      {engagement.registeredOffice && (
        <div className="mt-4 border-t border-border/70 pt-3">
          <dt className="text-[11px] font-medium text-muted-foreground">
            Registered office
          </dt>
          <dd className="mt-1.5 whitespace-pre-line text-[12.5px] font-semibold leading-relaxed text-ink">
            {engagement.registeredOffice}
          </dd>
        </div>
      )}
    </section>
  );
}

function IdField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">
        <Mono className="block break-all text-[12.5px] font-medium tracking-tight text-ink">
          {value}
        </Mono>
      </dd>
    </div>
  );
}
