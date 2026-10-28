'use client';

/**
 * Audit — prototype s/team/audit_redesign.dc.html (+ audit_drill, audit_filtered).
 * Client-safe projection from NEW `/api/client/audit` (staff by name + role
 * only, facts in plain words, 14-day summary, keyset "Load older"); CSV from
 * `/api/client/audit/export` with the current filters.
 * VCFO Spectrum (C-0029, R-07, R-08): no bar chart; the events sit in T1 rows with the
 * search, filters and Export in the card head. A date opens that day's drill-down.
 */
import { sep } from '@/lib/date-format';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AuditNode, ClientAuditEvent, ClientAuditPage } from '@/lib/client-portal/audit';
import { usePortal } from '../../PortalProvider';
import { CardHead, CloseBtn, Dialog, Empty, P, SArea, SOwner, Seg, Svg, Tile, api, avatarColor, useIsPhone, useScrollAfterClose, useSkeleton, type TileTone } from './common';
import '../../css/team-00-contract.css';
import '../../css/team-audit.css';

/* rule 18 glyphs, drawn in the Spectrum icon tile (R-16) */
const IC: Record<AuditNode, string> = {
  req: 'M12 5.2a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8Z M5.8 19.2a6.2 6.2 0 0 1 12.4 0Z',
  back: 'M12 6.5v7 M12 17.3h.01',
  up: 'M5.5 16 10 11.5l3 3 5.5-5.5 M14.5 9H18.5V13',
  ok: 'M6.5 12.5 10.5 16.5 17.5 8.5',
  time: 'M5.5 16 10 11.5l3 3 5.5-5.5 M14.5 9H18.5V13',
  mail: 'M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5',
  team: 'M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M18 8v6 M15 11h6',
};
const TONE: Record<AuditNode, TileTone> = { req: 'amber', back: 'red', up: 'brand', ok: 'green', time: 'brand', mail: 'violet', team: 'blue' };
const CATS = ['All', 'Documents', 'Milestones', 'Team', 'Email', 'Credentials'] as const;

function Node({ e, company }: { e: ClientAuditEvent; company: string }) {
  const tip = tipFor(e, company);
  return (
    <span className="tb-node" data-tip={tip} aria-label={tip} role="img">
      <Tile d={IC[e.node]} tone={TONE[e.node]} sw={2.2} />
    </span>
  );
}
function tipFor(e: ClientAuditEvent, company: string): string {
  return {
    req: `Waiting on ${company}`,
    back: 'Sent back · fix needed',
    up: 'With SBC · to review',
    ok: 'Done',
    time: 'With SBC · timeline',
    mail: 'Email',
    team: 'Team change',
  }[e.node];
}

function dayParts(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  return {
    n: String(d.getUTCDate()),
    m: sep(d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })),
    wd: sep(d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })),
  };
}

export function AuditPage() {
  const { shell, go, toast } = usePortal();
  const companyShort = shell?.companyShort ?? 'you';
  const isPhone = useIsPhone();
  const scrollAfter = useScrollAfterClose();
  const q = useInfiniteQuery({
    queryKey: ['client-portal', 'audit'],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<ClientAuditPage>(`/api/client/audit?limit=60${pageParam ? `&before=${encodeURIComponent(pageParam)}` : '&summary=1'}`),
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
  const sk = useSkeleton(q.isLoading);
  const [tab, setTab] = useState(0);
  const [who, setWho] = useState(0);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [dd, setDd] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [text]);

  const E = useMemo(() => q.data?.pages.flatMap((p) => p.events) ?? [], [q.data]);
  const summary = q.data?.pages[0]?.summary;
  const today = summary?.days[summary.days.length - 1]?.day;

  const fw = (e: ClientAuditEvent) => who === 0 || e.who.side === (who === 1 ? 'sbc' : 'client');
  const fs = (e: ClientAuditEvent) => !search || `${e.action} ${e.subject} ${e.who.name}`.toLowerCase().includes(search);
  const fc = (e: ClientAuditEvent) => tab === 0 || e.cat === CATS[tab];
  const filtered = E.filter((e) => fc(e) && fw(e) && fs(e));
  const bars = summary?.days ?? [];
  const exportHref = () => {
    const p = new URLSearchParams();
    if (tab) p.set('cat', CATS[tab]);
    if (who) p.set('who', who === 1 ? 'sbc' : 'client');
    if (search) p.set('q', search);
    return `/api/client/audit/export${p.toString() ? `?${p}` : ''}`;
  };
  const filteredOn = tab !== 0 || who !== 0 || !!search;
  const clear = () => {
    setTab(0);
    setWho(0);
    setText('');
  };
  /** The day drill-down covers the 14 summary days that have events. */
  const dayIndex = (day: string) => bars.findIndex((b) => b.day === day && b.count > 0);

  return (
    <div className="cp-team">
      <main className="pg tb-wrap tp-audit">
        <section className="sx-card" aria-labelledby="au-t">
          <CardHead
            id="au-t"
            d="M7 3.5h7l4 4v13H7Z M14 3.5v4h4 M10 13h5 M10 16.5h5"
            tone="green"
            title="Audit"
            meta={summary ? `${summary.total} ${summary.total === 1 ? 'event' : 'events'} in 14 days` : undefined}
          >
            <label className="tb-srch">
              <span className="tb-srch-i">
                <Svg d={P.search} join={false} size={14} sw={1.8} />
              </span>
              <input className="inp" aria-label="Search the audit log" placeholder="Search" value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <a className="btn btn-o btn-sm" href={exportHref()} download onClick={() => toast('Download started · audit log (CSV)')}>
              <Svg d={P.download} sw={1.8} />
              Export
            </a>
          </CardHead>
          <div className="tb-hd">
            <Seg
              tabs={CATS.map((l, i) => ({ label: l, cnt: E.filter((e) => (i === 0 || e.cat === l) && fw(e) && fs(e)).length }))}
              active={tab}
              onPick={setTab}
              label="Filter by type"
              grid={false}
            />
            <Seg tabs={['Everyone', 'SBC', companyShort === 'you' ? 'Client' : companyShort].map((l) => ({ label: l }))} active={who} onPick={setWho} label="Filter by who" grid={false} />
          </div>
          {q.isLoading ? (
            sk ? (
              <div style={{ padding: '8px 16px 16px', display: 'grid', gap: 8 }} aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="sk" style={{ display: 'block', height: 44 }} />
                ))}
              </div>
            ) : null
          ) : q.isError ? (
            <Empty
              role="alert"
              action={
                <button type="button" className="btn btn-o btn-sm" onClick={() => void q.refetch()}>
                  Try again
                </button>
              }
            >
              Could not load the audit log
            </Empty>
          ) : filtered.length === 0 ? (
            <Empty
              action={
                E.length && filteredOn ? (
                  <button type="button" className="btn btn-o btn-sm" onClick={clear}>
                    Clear filters
                  </button>
                ) : undefined
              }
            >
              {E.length ? 'No events match these filters' : 'No events yet'}
            </Empty>
          ) : (
            <div className="tb-tw">
              <table className="sx-t1 tb-events">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 120 }}>
                      When
                    </th>
                    <th scope="col">Event</th>
                    <th scope="col" className="tb-d" style={{ width: 124 }}>
                      Area
                    </th>
                    <th scope="col" className="tb-d" style={{ width: 260 }}>
                      Who
                    </th>
                    <th scope="col" style={{ width: 48 }} aria-label="Details" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const p = dayParts(e.day);
                    const open = openId === e.id;
                    const di = dayIndex(e.day);
                    const label = `${e.day === today ? 'Today' : `${p.n} ${p.m}`} ${e.time}`;
                    return (
                      <Fragment key={e.id}>
                        <tr className={open ? 'on' : undefined}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {di >= 0 ? (
                              <button type="button" className="tb-when" aria-label={`Show all events on ${p.n} ${p.m}`} onClick={() => setDd(di)}>
                                {label}
                              </button>
                            ) : (
                              <span className="cap">{label}</span>
                            )}
                          </td>
                          <td>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
                              <Node e={e} company={companyShort} />
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 500 }}>{e.action}</span>
                                <span className="cap tb-sub">{e.subject}</span>
                                <span className="cap tb-m tb-flex" style={{ marginTop: 2, gap: 4 }}>
                                  {e.who.name} · {e.who.role}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td className="tb-d">
                            <SArea area={e.cat} />
                          </td>
                          <td className="tb-d">
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span
                                className="av"
                                style={{ width: 24, height: 24, fontSize: 10, background: e.who.side === 'client' ? 'oklch(var(--brand))' : avatarColor(e.who.name) }}
                              >
                                {e.who.initials}
                              </span>
                              <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{e.who.name}</span>
                              <SOwner side={e.who.side} label={e.who.role} />
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button type="button" className="ibtn ghost" onClick={() => setOpenId(open ? null : e.id)} aria-expanded={open} aria-label="Details">
                              <Svg d={P.chevron} size={14} join={false} style={open ? { transform: 'rotate(180deg)' } : undefined} />
                            </button>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="tb-facts-row">
                            <td colSpan={5}>
                              <div className="tb-facts">
                                {e.facts.length ? (
                                  e.facts.map((f) => (
                                    <div key={f.k}>
                                      <div className="lbl">{f.k}</div>
                                      <div className="rt" style={{ marginTop: 3 }}>
                                        {f.v}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div>
                                    <div className="lbl">When</div>
                                    <div className="rt" style={{ marginTop: 3 }}>
                                      {p.n} {p.m}, {e.time}
                                    </div>
                                  </div>
                                )}
                                {e.cta ? (
                                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                                    <a
                                      href={e.cta.href}
                                      className="btn btn-n btn-sm"
                                      onClick={(ev) => {
                                        ev.preventDefault();
                                        go(e.cta!.href);
                                      }}
                                    >
                                      {e.cta.label}
                                    </a>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {q.hasNextPage || (filteredOn && filtered.length > 0) ? (
            <div className="tb-foot">
              {filteredOn && filtered.length > 0 ? (
                <button type="button" className="btn btn-g btn-sm" onClick={clear}>
                  Clear filters
                </button>
              ) : null}
              {q.hasNextPage ? (
                <button type="button" className="btn btn-o btn-sm" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                  {q.isFetchingNextPage ? 'Loading…' : 'Load older'}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>

      {dd !== null && bars[dd] ? (
        <DayDrill
          bars={bars}
          dd={dd}
          setDd={setDd}
          sheet={isPhone}
          today={today}
          company={companyShort}
          onLink={() => {
            setDd(null);
            scrollAfter(280);
          }}
          onOpen={(e) => {
            setDd(null);
            if (e.cta) go(e.cta.href);
            else setOpenId(e.id);
          }}
        />
      ) : null}
    </div>
  );
}

function DayDrill({
  bars,
  dd,
  setDd,
  sheet,
  today,
  company,
  onLink,
  onOpen,
}: {
  company: string;
  bars: Array<{ day: string; count: number }>;
  dd: number;
  setDd: (d: number | null) => void;
  sheet: boolean;
  today?: string;
  onLink: () => void;
  onOpen: (e: ClientAuditEvent) => void;
}) {
  const day = bars[dd].day;
  const q = useQuery({ queryKey: ['client-portal', 'audit-day', day], queryFn: () => api<{ events: ClientAuditEvent[] }>(`/api/client/audit?day=${day}`) });
  const active = bars.map((_, i) => i).filter((i) => bars[i].count > 0).reverse();
  const pos = Math.max(active.indexOf(dd), 0);
  const p = dayParts(day);
  const n = bars[dd].count;
  return (
    <Dialog labelledBy="ab-t" width={760} top sheet={sheet} onClose={() => setDd(null)} tp="tp-audit">
      <div className="dlg-h">
        <div className="dtile tb-dt">
          <span className="d">{p.n}</span>
          <span className="m">{p.m}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="ab-t" style={{ margin: 0 }}>
            {day === today ? 'Today' : p.wd}, {p.n} {p.m}
          </h2>
          <div className="cap">
            {n} {n === 1 ? 'event' : 'events'}
          </div>
        </div>
        <CloseBtn onClick={() => setDd(null)} />
      </div>
      <div style={{ padding: '12px 16px 4px' }}>
        <Seg
          tabs={active.map((i) => {
            const x = dayParts(bars[i].day);
            return { label: `${x.n} ${x.m}`, cnt: bars[i].count };
          })}
          active={pos}
          onPick={(k) => setDd(active[k])}
          label="Pick a day"
          grid={false}
          btnStyle={{ padding: '0 8px' }}
        />
      </div>
      <div style={{ padding: '4px 0 8px', maxHeight: 'min(420px,52dvh)', overflow: 'auto' }}>
        {q.isLoading ? (
          <div style={{ padding: '10px 16px' }} aria-hidden="true">
            <div className="sk" style={{ height: 44 }} />
          </div>
        ) : (
          (q.data?.events ?? []).map((e) => (
            <a
              key={e.id}
              href={e.cta?.href ?? '#'}
              className="row"
              style={{ color: 'inherit', fontWeight: 'inherit', padding: '8px 16px' }}
              onClick={(ev) => {
                ev.preventDefault();
                onOpen(e);
              }}
            >
              <span className="cap" style={{ width: 44, flex: 'none' }}>
                {e.time}
              </span>
              <Node e={e} company={company} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>{e.action}</span>
                <span className="cap tb-sub">
                  {e.subject}
                  <span className="tb-m"> · {e.who.name}</span>
                </span>
              </span>
              <span className="tb-d">
                <SArea area={e.cat} />
              </span>
              <span className="tb-d" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                {e.who.name}
              </span>
              <span style={{ color: 'oklch(var(--ink-faint))', display: 'flex' }}>
                <Svg d={P.next} size={14} sw={1.8} />
              </span>
            </a>
          ))
        )}
      </div>
      <div className="dlg-f">
        <button type="button" className="btn btn-n" onClick={() => onLink()}>
          Show in the Audit log
        </button>
      </div>
    </Dialog>
  );
}
