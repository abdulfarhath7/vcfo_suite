'use client';

/**
 * Registrations (VCFO Spectrum RegistrationsScreen, owner decision D-06): the registration
 * phase of the client's incorporation checklist, one row per registration with its date
 * tile, the name, the area pill, the stored number (or an empty mark), the owner and the
 * status. Not-applicable steps sit in a folded "Not needed" group. The right rail keeps
 * three cards: Due in the next 15 days, Waiting on client, Progress flow.
 *
 * Data: the step model (`usePortalIncorporation`, the client-redacted checklist state) and
 * the numbers stored on the credentials workbook (GET /api/client/credentials).
 */
import { useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { SkeletonRows } from '@/components/ui/empty-state';
import { clientIncorporationStepPath } from '@/lib/projects/project-step-path';
import { todayIso } from '@/lib/client-portal/compliances';
import { usePortal } from '../../PortalProvider';
import { usePortalIncorporation } from '../../hooks';
import { usePageTips } from '../compliances/bits';
import { Empty, GoLink, GroupHead, HeadSearch, Island, ListRow, SCard, StackedBar, WordPill, relativeDue } from '../compliances/spectrum';
import { GROUP_ORDER, buildRegistrations, regDueWithin, regWaiting, type RegItem, type RegStatus } from './model';
import { REG_FILL, REG_ORDER, RegChip, RegOwner, RegTile, registrationHref, useRegCredentials } from './parts';
import '../../css/compliances-board.css';

export function RegistrationsList() {
  const today = todayIso();
  const { go } = usePortal();
  const root = useRef<HTMLDivElement>(null);
  usePageTips(root);
  const { model, loading } = usePortalIncorporation();
  const creds = useRegCredentials();
  const items = useMemo(() => buildRegistrations(model, creds.data), [model, creds.data]);
  const [view, setView] = useState<'status' | 'group'>('status');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RegStatus | null>(null);
  const [closed, setClosed] = useState<Record<string, boolean>>({ na: true });

  const active = items.filter((r) => !r.notNeeded);
  const notNeeded = items.filter((r) => r.notNeeded);
  const needle = search.trim().toLowerCase();
  const match = (r: RegItem) => !needle || `${r.name} ${r.area} ${r.group} ${r.number ?? ''}`.toLowerCase().includes(needle);
  const shown = active.filter((r) => match(r) && (!status || r.status === status));
  const sections = [
    ...(view === 'status'
      ? REG_ORDER.map((s) => ({ id: s, label: s, rows: shown.filter((r) => r.status === s) }))
      : GROUP_ORDER.map((g) => ({ id: g, label: g, rows: shown.filter((r) => r.group === g) }))),
    { id: 'na', label: 'Not needed', rows: status ? [] : notNeeded.filter(match) },
  ].filter((s) => s.rows.length);

  const due = regDueWithin(items, today, 15);
  const waiting = regWaiting(items);
  const count = (s: RegStatus) => active.filter((r) => r.status === s).length;

  const head = (
    <span className="flex flex-wrap items-center gap-2">
      <HeadSearch value={search} onChange={setSearch} label="Search registrations" onEnter={() => shown[0] && go(registrationHref(shown[0].id))} />
      <SpectrumTabs
        label="Group registrations"
        size="md"
        value={view}
        onChange={(k) => setView(k as 'status' | 'group')}
        items={[
          { key: 'status', label: 'By status' },
          { key: 'group', label: 'By group' },
        ]}
      />
    </span>
  );

  const list = loading ? (
    <div className="px-4 py-4 md:px-5" aria-busy="true" aria-label="Loading registrations">
      <SkeletonRows rows={5} />
    </div>
  ) : !items.length ? (
    <Empty>No registrations on your checklist</Empty>
  ) : !sections.length ? (
    <Empty
      action={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setSearch('');
            setStatus(null);
          }}
        >
          Clear
        </Button>
      }
    >
      None
    </Empty>
  ) : (
    <div>
      {status ? (
        <div className="flex items-center gap-2 border-b border-line-soft px-4 py-2 md:px-5">
          <span className="inline-flex h-[30px] items-center gap-1.5 rounded-md border-1.5 border-brand-line bg-brand-soft pl-2.5 pr-1 text-[13px] font-medium text-brand-text">
            {status}
            <button type="button" className="grid h-5 w-5 place-items-center rounded-sm hover:bg-surface-raised" aria-label="Clear the status filter" onClick={() => setStatus(null)}>
              ×
            </button>
          </span>
        </div>
      ) : null}
      {creds.isError ? (
        <p className="border-b border-line-soft px-4 py-2 text-[13px] text-ink-muted md:px-5" role="status">
          Registration numbers could not load
        </p>
      ) : null}
      {sections.map((g) => {
        const open = needle || status ? true : !closed[g.id];
        return (
          <div key={g.id}>
            <GroupHead label={g.label} count={g.rows.length} open={Boolean(open)} onToggle={() => setClosed((c) => ({ ...c, [g.id]: !c[g.id] }))} />
            {open ? (
              <ul className={g.id === 'na' ? '[&_a]:opacity-70' : undefined}>
                {g.rows.map((r) => (
                  <li key={r.stepId}>
                    <RegRow r={r} today={today} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="cp-compliances">
      <div className="cp-comp-root page" ref={root}>
        <Island className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <SCard title="Registrations" meta={items.length ? active.length : undefined} right={head} flush>
            {list}
          </SCard>
          <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-1">
            <SCard title="Due in the next 15 days" meta={due.length} flush>
              {due.length ? (
                due.slice(0, 8).map((r) => {
                  const rel = relativeDue(today, r.due!);
                  return (
                    <GoLink
                      key={r.stepId}
                      href={registrationHref(r.id)}
                      label={`${r.name} · ${rel.label}`}
                      className={`flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-2.5 text-[14px] text-ink first:border-t-0 hover:bg-surface-sunken md:px-5${rel.tone === 'bad' ? ' bg-danger-soft' : ''}`}
                    >
                      <RegTile r={r} today={today} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{r.name}</span>
                        <span className="block truncate text-[12.5px] text-ink-muted">{r.group}</span>
                      </span>
                      <Chip tone={rel.tone} fixed>
                        {rel.label}
                      </Chip>
                    </GoLink>
                  );
                })
              ) : (
                <Empty />
              )}
            </SCard>
            <SCard title="Waiting on client" meta={waiting.length} flush>
              {waiting.length ? (
                waiting.slice(0, 8).map((r) => (
                  <ListRow key={r.stepId}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-[12.5px] text-ink-muted">{r.needs.slice(0, 2).join(', ') || r.group}</span>
                    </span>
                    <Button size="sm" onClick={() => go(clientIncorporationStepPath(r.step.item))}>
                      Open
                    </Button>
                  </ListRow>
                ))
              ) : (
                <Empty />
              )}
            </SCard>
            <SCard title="Progress flow" className="md:col-span-2 lg:col-span-1">
              <StackedBar
                onPick={(k) => setStatus((cur) => (cur === k ? null : (k as RegStatus)))}
                segments={REG_ORDER.map((s) => ({ key: s, label: s, value: count(s), fill: REG_FILL[s] }))}
              />
            </SCard>
          </div>
        </Island>
      </div>
    </div>
  );
}

function RegRow({ r, today }: { r: RegItem; today: string }) {
  return (
    <GoLink
      href={registrationHref(r.id)}
      label={`${r.name} · ${r.notNeeded ? 'Not needed' : r.status}`}
      className="flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-2.5 text-[14px] text-ink hover:bg-surface-sunken md:px-5"
    >
      <RegTile r={r} today={today} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-ink">{r.name}</span>
        <span className="block truncate text-[12.5px] text-ink-muted">
          {r.number ? <span className="font-mono text-[12.5px] text-ink-2">{r.number}</span> : r.forms.join(' · ') || r.group}
        </span>
      </span>
      <WordPill word={r.area} className="hidden sm:inline-flex" />
      <span className="hidden md:inline-flex">
        <RegOwner r={r} />
      </span>
      <RegChip r={r} />
      <ChevronRight size={16} strokeWidth={1.6} className="flex-none text-ink-faint" aria-hidden />
    </GoLink>
  );
}
