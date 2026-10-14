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

  if (rows.length === 0 && !engagement.incorporationDate) {
    return (
      <section className="border border-border bg-panel px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted-foreground">Your entity</p>
            <h2 className="mt-0.5 break-words text-[15px] font-semibold leading-snug text-foreground">
              {engagement.companyName}
            </h2>
            <p className="mt-1 text-[13px] text-foreground">
              {LEGAL_FORM_LABEL[engagement.legalForm]}
              {engagement.parentEntityName ? ` · subsidiary of ${engagement.parentEntityName}` : ''}
            </p>
          </div>
          <span className="shrink-0 rounded-sm bg-warning-light px-2 py-0.5 text-[11px] font-semibold text-warning-text">
            Forming
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {['CIN', 'PAN', 'TAN'].map((label) => (
            <div key={label} className="rounded-lg border border-border px-2.5 py-2">
              <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-[12px] font-medium text-foreground">After COI</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <section className="client-idcard px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">
            Registered entity
          </p>
          <h2 className="mt-0.5 break-words text-[15px] font-semibold leading-snug text-foreground">
            {engagement.companyName}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {LEGAL_FORM_LABEL[engagement.legalForm]}
            {engagement.parentEntityName ? ` · subsidiary of ${engagement.parentEntityName}` : ''}
          </p>
        </div>
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-success-light px-2 py-0.5 text-[11px] font-medium text-success-text"
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
          <dt className="text-[12px] text-muted-foreground">
            Registered office
          </dt>
          <dd className="mt-1 whitespace-pre-line text-[13.5px] font-medium leading-snug text-foreground">
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
      <dt className="text-[12px] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">
        <Mono className="block break-all text-[13.5px] font-medium tracking-tight text-foreground">
          {value}
        </Mono>
      </dd>
    </div>
  );
}
