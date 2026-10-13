'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ClientCompanySnapshot as Snapshot } from '@/lib/client-overview';
import { ClientCard } from '@/components/client/overview/ClientCard';
import { formatCount, formatInr } from '@/components/client/overview/client-overview-format';

/**
 * Company snapshot on the client home: who sits on the board, the share
 * capital and who subscribes to it. Read from the pre-incorporation steps
 * (`pre-15`, `pre-1`, `pre-13`, `pre-16`); every block links to the step that
 * holds it. Shown before and after incorporation.
 */
export function ClientCompanySnapshot({ company }: { company: Snapshot }) {
  const { directors, capital, subscribers, links } = company;
  const hasCapital = Boolean(capital.authorised || capital.paidUp || capital.shareClasses.length);

  return (
    <ClientCard title="Company snapshot" bodyClassName="px-4 pb-4 pt-2.5">
      <div className="grid gap-4 md:grid-cols-3">
        <Block
          title="Board of directors"
          href={links.directors}
          linkLabel={directors.length ? 'View directors' : 'Add directors'}
        >
          {directors.length === 0 ? (
            <Empty>No directors added yet.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {directors.map((director, index) => (
                <li key={`${director.name}-${index}`} className="text-[13px] text-foreground">
                  <span className="font-semibold">{director.name}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {[
                      director.indiaResident === true
                        ? 'Resident in India'
                        : director.indiaResident === false
                          ? 'Not resident in India'
                          : null,
                      director.din ? `DIN ${director.din}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block
          title="Share capital"
          href={links.capital}
          linkLabel={hasCapital ? 'View share capital' : 'Enter share capital'}
        >
          {!hasCapital ? (
            <Empty>Not entered yet.</Empty>
          ) : (
            <dl className="space-y-1.5 text-[13px]">
              <Row label="Authorised" value={formatInr(capital.authorised)} />
              <Row label="Paid-up" value={formatInr(capital.paidUp)} />
              {capital.nominalValue ? (
                <Row label="Nominal value per share" value={formatInr(capital.nominalValue)} />
              ) : null}
              {capital.shareClasses.map((shareClass) => (
                <Row
                  key={shareClass.kind}
                  label={shareClass.kind === 'equity' ? 'Equity shares' : 'Preference shares'}
                  value={[
                    formatCount(shareClass.quantity),
                    shareClass.nominalValue ? `× ${formatInr(shareClass.nominalValue)}` : null,
                    shareClass.total ? `= ${formatInr(shareClass.total)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ))}
            </dl>
          )}
          {capital.shareClasses.length > 0 ? (
            <Link href={links.shareClasses} className="mt-1 inline-block text-[12px] font-medium text-brand hover:underline">
              View share classes
            </Link>
          ) : null}
        </Block>

        <Block
          title="Subscribers"
          href={links.subscribers}
          linkLabel={subscribers.length ? 'View subscribers' : 'Add subscribers'}
        >
          {subscribers.length === 0 ? (
            <Empty>No subscribers added yet.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {subscribers.map((subscriber, index) => (
                <li key={`${subscriber.name}-${index}`} className="text-[13px] text-foreground">
                  <span className="font-semibold">{subscriber.name}</span>
                  {subscriber.shares ? (
                    <span className="block text-[11px] text-muted-foreground">
                      {formatCount(subscriber.shares)} shares
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>
    </ClientCard>
  );
}

function Block({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0">
      <h3 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h3>
      {children}
      <Link href={href} className="mt-2 inline-block text-[12px] font-medium text-brand hover:underline">
        {linkLabel}
      </Link>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-foreground">{value ?? '—'}</dd>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-muted-foreground">{children}</p>;
}
