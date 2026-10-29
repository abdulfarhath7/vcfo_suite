'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { HeadLink } from '@/components/dash/DashSection';

/**
 * One pop-up for every drill (VCFO Spectrum, prototype cards/DrillDialog, v7x_drilldown): tabs
 * over rows, the clicked part picked. Each row has the name, the meta in Roboto Mono 12px, the R-13
 * status chip and a chevron when it opens a page. The footer says how many rows show and links to
 * the full list. Use `useDrill()` and render its `node` once per screen.
 */

export interface DrillRow {
  name: string;
  /** A date or short meta: "9 Oct", "day 6 of 30 · 2 Dec". */
  meta?: string;
  status: string;
  tone?: ChipTone;
  /** Index of the tab that holds the row. When tab 0 is "All", it shows every row. */
  tab: number;
  href?: string;
}

export interface DrillSpec {
  title: string;
  /** A first tab labelled "All" shows every row. */
  tabs: Array<{ label: string; count?: number }>;
  rows: DrillRow[];
  /** Where the full list lives: { name: 'Incorporation', href: '/app/client/incorporation' }. */
  link?: { name: string; href: string };
}

export function DrillDialog({
  spec,
  active = 0,
  open,
  onOpenChange,
}: {
  spec: DrillSpec | null;
  active?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState(active);
  useEffect(() => setTab(active), [active, spec]);
  if (!spec) return null;
  const all = spec.tabs[0]?.label === 'All';
  const rows = spec.rows.filter((r) => (all && tab === 0) || r.tab === tab);
  const total = spec.tabs[tab]?.count ?? rows.length;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={spec.title}
      flush
      footer={
        <>
          <span className="mr-auto text-[12.5px] text-ink-muted">
            {rows.length < total ? `Showing ${rows.length} of ${total}` : `Showing all ${total}`}
          </span>
          {spec.link ? <HeadLink href={spec.link.href}>Open {spec.link.name.toLowerCase()}</HeadLink> : null}
        </>
      }
    >
      {spec.tabs.length > 1 ? (
        <div className="border-b border-line-soft px-4 py-2.5 md:px-5">
          <SpectrumTabs
            label={spec.title}
            items={spec.tabs.map((t, i) => ({ key: String(i), label: t.label, count: t.count }))}
            value={String(tab)}
            onChange={(k) => setTab(Number(k))}
          />
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="None" className="m-4 md:mx-5" />
      ) : (
        <ul>
          {rows.map((r, i) => {
            const inner = (
              <>
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.name}</span>
                {r.meta ? <span className="hidden flex-none font-mono text-[12px] text-ink-muted sm:inline">{r.meta}</span> : null}
                <Chip tone={r.tone} fixed className="hidden sm:inline-flex">
                  {r.status}
                </Chip>
                <Chip tone={r.tone} className="sm:hidden">
                  {r.status}
                </Chip>
                {r.href ? <ChevronRight size={16} strokeWidth={1.6} className="flex-none text-ink-faint" aria-hidden /> : null}
              </>
            );
            const cls = 'flex items-center gap-3 border-t border-line-soft px-4 py-3 text-[13.5px] md:px-5';
            return (
              <li key={`${r.name}-${i}`} className="[&:first-child>*]:border-t-0">
                {r.href ? (
                  <Link href={r.href} className={`${cls} transition-colors hover:bg-hover`} onClick={() => onOpenChange(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Keeps one drill open at a time. Call `open(spec, tab)` from any trigger; render `node` once. */
export function useDrill() {
  const [state, setState] = useState<{ spec: DrillSpec; tab: number } | null>(null);
  const [isOpen, setOpen] = useState(false);
  const open = useCallback((spec: DrillSpec, tab = 0) => {
    setState({ spec, tab });
    setOpen(true);
  }, []);
  const node = <DrillDialog spec={state?.spec ?? null} active={state?.tab ?? 0} open={isOpen} onOpenChange={setOpen} />;
  return { open, node };
}
