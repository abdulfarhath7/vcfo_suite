'use client';

import { useState } from 'react';
import { CheckCircle2, Download, FilterX, Flag, Link2, Mail, Search, SlidersHorizontal, UserRoundPlus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { DensityMenu } from '@/components/ui/density-menu';
import { TOOL_BTN } from './PublishBar';
import { PopoverCard } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { BulkBar } from '@/components/ui/bulk-bar';
import { FilterSelect } from '@/components/ui/native-select';
import { monthLong } from '@/lib/receivables/dates';
import type { ShareStatus } from '@/lib/receivables/share-filters';
import type { Partner } from '@/lib/receivables/model';
import { inr } from '../../format';
import { STATUS_CHOICES } from './sheet-filters';
import type { SheetTabState } from './use-sheet-tab';

const MULTI = '__multi';

/** One value of a list filter for a single-choice select; several values read "N picked". */
function listValue(list: string[] | undefined): string {
  if (!list?.length) return 'all';
  return list.length === 1 ? list[0]! : MULTI;
}

function listOptions(list: string[] | undefined, all: string, noun: string, choices: Array<{ value: string; label: string }>) {
  return [{ value: 'all', label: all }, ...(list && list.length > 1 ? [{ value: MULTI, label: `${list.length} ${noun}` }] : []), ...choices];
}

/**
 * The sheet's one toolbar row (17 Nov 2026): `before` (Invoice, Import Tally, Send email), the
 * search box, one Filters button that
 * opens partner, client, status, month and currency (all kept in the URL), the filters in use as
 * small chips with a ×, v2's "Fix in Tally" toggle, Clear, Share this view (only with
 * RECEIVABLES_EXTERNAL), `after` (the publish state and the approval queue) and the row density
 * switch. Under it, the count and total of the rows
 * shown, or the bulk bar while rows are picked.
 */
export function SheetFilterBar({
  s,
  partners,
  canShare,
  before,
  after,
  onEmailPicked,
}: {
  s: SheetTabState;
  partners: Partner[];
  canShare: boolean;
  before?: ReactNode;
  after?: ReactNode;
  /** "Send email" for the picked invoices only. */
  onEmailPicked?: () => void;
}) {
  const f = s.filters;
  const pick = (v: string) => (v === 'all' ? undefined : v === MULTI ? undefined : [v]);
  const active = partners.filter((p) => p.active);
  const [open, setOpen] = useState(false);
  // The filters in use, each a small chip with a × that removes it.
  const chips: Array<{ key: string; label: string; clear: () => void }> = [
    ...(f.partnerSlugs ?? []).map((slug) => ({
      key: `p-${slug}`,
      label: `Partner: ${partners.find((p) => p.slug === slug)?.name ?? slug}`,
      clear: () => s.patchFilters({ partnerSlugs: (f.partnerSlugs ?? []).filter((x) => x !== slug) }),
    })),
    ...(f.clients ?? []).map((c) => ({ key: `c-${c}`, label: `Client: ${c}`, clear: () => s.patchFilters({ clients: (f.clients ?? []).filter((x) => x !== c) }) })),
    ...(s.status !== 'open' ? [{ key: 'status', label: `Status: ${STATUS_CHOICES.find((c) => c.value === s.status)?.label ?? s.status}`, clear: () => s.patchFilters({ status: 'open' as ShareStatus }) }] : []),
    ...(f.months ?? []).map((m) => ({ key: `m-${m}`, label: `Month: ${monthLong(m)}`, clear: () => s.patchFilters({ months: (f.months ?? []).filter((x) => x !== m) }) })),
    ...(f.currency ? [{ key: 'cur', label: `Currency: ${f.currency}`, clear: () => s.patchFilters({ currency: null }) }] : []),
  ];
  const selectClass = 'w-full';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {before}
        {before ? <span aria-hidden className="mx-0.5 h-5 w-px bg-line" /> : null}
        <div role="search" aria-label="Filter invoices" className="contents">
        <label className="relative flex min-w-[180px] flex-[1_1_220px] items-center sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-2 size-3.5 text-ink-muted" strokeWidth={1.6} aria-hidden />
          <span className="sr-only">Search client, invoice number or partner</span>
          <input
            type="search"
            value={s.search}
            onChange={(e) => s.setSearch(e.target.value)}
            placeholder="Search client, invoice, partner"
            className="h-7 w-full rounded-md border border-line-strong bg-surface-raised pl-7 pr-2 text-[12.5px] text-ink outline-none placeholder:text-ink-faint focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-focus-ring/25"
          />
        </label>
        <PopoverCard
          open={open}
          onOpenChange={setOpen}
          width={300}
          label="Filters"
          title="Filters"
          trigger={
            <Button size="sm" variant="secondary" className={TOOL_BTN} aria-label={`Filters${chips.length ? ` (${chips.length} in use)` : ''}`}>
              <SlidersHorizontal aria-hidden />
              {chips.length ? `Filters · ${chips.length}` : 'Filters'}
            </Button>
          }
        >
          <div className="grid gap-2 p-3 text-[12.5px]">
            <FilterSelect
              className={selectClass}
              aria-label="Client partner"
              value={listValue(f.partnerSlugs)}
              onChange={(e) => e.target.value !== MULTI && s.patchFilters({ partnerSlugs: pick(e.target.value) })}
              options={listOptions(f.partnerSlugs, 'All partners', 'partners', partners.map((p) => ({ value: p.slug, label: p.name })))}
            />
            <FilterSelect
              className={selectClass}
              aria-label="Client"
              value={listValue(f.clients)}
              onChange={(e) => e.target.value !== MULTI && s.patchFilters({ clients: pick(e.target.value) })}
              options={listOptions(f.clients, 'All clients', 'clients', s.clients.map((c) => ({ value: c, label: c })))}
            />
            <FilterSelect className={selectClass} aria-label="Status" value={s.status} onChange={(e) => s.patchFilters({ status: e.target.value as ShareStatus })} options={STATUS_CHOICES} />
            <FilterSelect
              className={selectClass}
              aria-label="Invoice month"
              value={listValue(f.months)}
              onChange={(e) => e.target.value !== MULTI && s.patchFilters({ months: pick(e.target.value) })}
              options={listOptions(f.months, 'All months', 'months', [...s.months].reverse().map((m) => ({ value: m, label: monthLong(m) })))}
            />
            {s.currencies.length > 1 || f.currency ? (
              <FilterSelect
                className={selectClass}
                aria-label="Currency"
                value={f.currency ?? 'all'}
                onChange={(e) => s.patchFilters({ currency: e.target.value === 'all' ? null : e.target.value })}
                options={[{ value: 'all', label: 'All currencies' }, ...s.currencies.map((c) => ({ value: c, label: c }))]}
              />
            ) : null}
          </div>
        </PopoverCard>
        {s.tallyMismatches || s.fixInTally ? (
          <Button size="sm" variant={s.fixInTally ? 'strong' : 'quiet'} className={TOOL_BTN} aria-pressed={s.fixInTally} onClick={() => s.setFixInTally(!s.fixInTally)} title="Invoices whose approved amount change is not in Tally yet">
            <Flag aria-hidden />
            {`Fix in Tally${s.tallyMismatches ? ` · ${s.tallyMismatches}` : ''}`}
          </Button>
        ) : null}
        {chips.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken py-0.5 pl-2 pr-0.5 text-[12px]">
            {c.label}
            <button type="button" aria-label={`Remove filter ${c.label}`} onClick={c.clear} className="grid size-4 place-items-center rounded-full text-ink-muted hover:bg-line hover:text-ink">
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        {s.filtered ? (
          <Button size="sm" variant="quiet" className={TOOL_BTN} onClick={s.clearFilters}>
            <FilterX aria-hidden />
            Clear
          </Button>
        ) : null}
        </div>
        <span className="flex-1" />
        {after}
        {canShare ? (
          <Button size="sm" variant="quiet" className={TOOL_BTN} onClick={() => s.setDialog({ kind: 'share-view' })}>
            <Link2 aria-hidden />
            Share this view
          </Button>
        ) : null}
        <DensityMenu value={s.density} onChange={s.setDensity} />
      </div>

      <div className="flex min-h-[28px] items-center gap-3 rounded-md px-1 text-[12.5px]">
        {s.picked.size ? (
          <BulkBar
            count={s.picked.size}
            onClear={s.clearPicked}
            noun={['invoice', 'invoices']}
            actions={[
              ...(onEmailPicked ? [{ key: 'email', label: 'Send email', icon: Mail, onClick: onEmailPicked }] : []),
              { key: 'received', label: 'Mark received', icon: CheckCircle2, disabled: !s.bulkReceivable.length, onClick: () => s.setDialog({ kind: 'bulk-received' }) },
              {
                key: 'assign',
                label: 'Assign partner',
                icon: UserRoundPlus,
                people: {
                  label: 'Assign to',
                  names: [...active.map((p) => p.name), 'No partner'],
                  onPick: (name) => s.bulkAssign(active.find((p) => p.name === name)?.id ?? null, name),
                },
              },
              { key: 'export', label: 'Export', icon: Download, onClick: s.exportPicked },
            ]}
          />
        ) : (
          <span className="text-ink-muted" aria-live="polite">
            <b className="font-medium text-ink">{`${s.rows.length} invoice${s.rows.length === 1 ? '' : 's'}`}</b>
            {` · ₹${inr(s.total)}`}
            {s.filtered ? ' · filtered' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
