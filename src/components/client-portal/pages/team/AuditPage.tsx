'use client';

/**
 * Audit — prototype s/team/audit_redesign.dc.html (+ audit_drill, audit_filtered).
 * Client-safe projection from NEW `/api/client/audit` (staff by name + role
 * only, facts in plain words, 14-day summary, keyset "Load older"); CSV from
 * `/api/client/audit/export` with the current filters.
 */
import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AuditNode, ClientAuditEvent, ClientAuditPage } from '@/lib/client-portal/audit';
import { usePortal } from '../../PortalProvider';
import { AskWhy, BotBubble, CloseBtn, Dialog, P, Seg, Svg, api, avatarColor, useIsPhone, useScrollAfterClose, useSkeleton } from './common';
import '../../css/team-00-contract.css';
import '../../css/team-audit.css';

/* rule 18 — set A solid glyphs (audit_redesign.dc.html:185-187) */
const IC: Record<AuditNode, string> = {
  req: 'M12 5.2a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8Z M5.8 19.2a6.2 6.2 0 0 1 12.4 0Z',
  back: 'M12 6.5v7 M12 17.3h.01',
  up: 'M5.5 16 10 11.5l3 3 5.5-5.5 M14.5 9H18.5V13',
  ok: 'M6.5 12.5 10.5 16.5 17.5 8.5',
  time: 'M5.5 16 10 11.5l3 3 5.5-5.5 M14.5 9H18.5V13',
  mail: 'M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z M4.5 7.5l7.5 5.5 7.5-5.5',
  team: 'M9 12.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7Z M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5 M18 8v6 M15 11h6',
};
const BG: Record<AuditNode, string> = {
  req: 'oklch(66% 0.17 55)',
  back: 'var(--over-chip)',
  up: 'oklch(55% 0.2 262)',
  ok: 'oklch(58% 0.15 155)',
  time: 'oklch(55% 0.2 262)',
  mail: 'var(--sky-chip)',
  team: 'var(--navy)',
};
const CATS = ['All', 'Documents', 'Milestones', 'Team', 'Email', 'Credentials'] as const;

const rc = (side: 'sbc' | 'client'): React.CSSProperties =>
  side === 'sbc' ? { background: 'var(--navy)', color: '#fff' } : { background: 'var(--gold-soft)', color: 'var(--gold-text)' };

function Node({ e, ring = true, company }: { e: ClientAuditEvent; ring?: boolean; company: string }) {
  const tip = tipFor(e, company);
  return (
    <span className="node" data-tip={tip} aria-label={tip} role="img" style={{ background: BG[e.node], ...(ring ? {} : { boxShadow: 'none' }) }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={IC[e.node]} fill={e.node === 'req' ? 'currentColor' : 'none'} />
      </svg>
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
    m: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
    wd: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
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
  const [hv, setHv] = useState<number | null>(null);
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
  const days = useMemo(() => {
    const out: Array<{ day: string; items: ClientAuditEvent[] }> = [];
    for (const e of filtered) {
      const last = out[out.length - 1];
      if (last && last.day === e.day) last.items.push(e);
      else out.push({ day: e.day, items: [e] });
    }
    return out;
  }, [filtered]);

  const bars = summary?.days ?? [];
  const max = Math.max(1, ...bars.map((b) => b.count));
  const scale = max * 14 > 60 ? 60 / max : 14; // keep the tallest bar inside the 64 px strip
  const exportHref = () => {
    const p = new URLSearchParams();
    if (tab) p.set('cat', CATS[tab]);
    if (who) p.set('who', who === 1 ? 'sbc' : 'client');
    if (search) p.set('q', search);
    return `/api/client/audit/export${p.toString() ? `?${p}` : ''}`;
  };

  return (
    <div className="cp-team">
      <main className="pg tb-wrap tp-audit">
        <div className="ph">
          <div className="acts">
            <label className="tb-srch">
              <span style={{ position: 'absolute', left: 10, top: 10, color: 'var(--subtle)' }}>
                <Svg d={P.search} join={false} />
              </span>
              <input className="inp" aria-label="Search the audit log" placeholder="Search" style={{ paddingLeft: 32 }} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <a
              className="btn btn-o"
              href={exportHref()}
              download
              onClick={() => toast('Download started · audit log (CSV)')}
            >
              <Svg d={P.download} sw={1.8} />
              Export
            </a>
          </div>
        </div>

        <section className="card t" style={{ padding: '14px 18px 12px', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="st">Last 14 days</h2>
            <span className="metric" style={{ fontSize: 20, marginLeft: 'auto' }}>
              {summary?.total ?? '–'}
            </span>
            <span className="cap">events</span>
          </div>
          <div className="tb-14" style={{ position: 'relative', alignItems: 'end', height: 64 }}>
            {bars.length === 0
              ? Array.from({ length: 14 }, (_, i) => <span key={i} className="sk" style={{ height: 3 + ((i * 7) % 30) }} />)
              : bars.map((b, i) => {
                  const p = dayParts(b.day);
                  const isToday = i === bars.length - 1;
                  const tipText = `${p.wd} ${p.n} ${p.m} · ${b.count}${b.count === 1 ? ' event' : ' events'}`;
                  return (
                    <button
                      key={b.day}
                      type="button"
                      className="tb-bar"
                      disabled={b.count === 0}
                      aria-label={tipText}
                      onClick={() => {
                        if (b.count) {
                          setHv(null);
                          setDd(i);
                        }
                      }}
                      onMouseEnter={() => setHv(i)}
                      onMouseLeave={() => setHv(null)}
                      onFocus={() => setHv(i)}
                      onBlur={() => setHv(null)}
                      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: '100%',
                          borderRadius: '3px 3px 0 0',
                          transformOrigin: 'bottom',
                          animation: 'grow .9s cubic-bezier(.2,.7,.2,1) backwards',
                          transition: 'opacity .15s',
                          height: Math.max(b.count * scale, 3),
                          background: !b.count ? 'var(--border)' : isToday ? 'var(--navy)' : 'var(--navy-3)',
                          opacity: (isToday && b.count) || hv === i ? 1 : 0.55,
                        }}
                      />
                    </button>
                  );
                })}
            {hv !== null && bars[hv] ? (
              <span
                role="tooltip"
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 4px)',
                  transform: 'translateX(-50%)',
                  background: 'var(--navy)',
                  color: '#fff',
                  font: '700 12px Manrope',
                  padding: '4px 9px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                  zIndex: 5,
                  pointerEvents: 'none',
                  boxShadow: '0 6px 16px -6px oklch(21% 0.042 264 / .5)',
                  left: `calc(${((hv + 0.5) / 14) * 100}% )`,
                }}
              >
                {(() => {
                  const p = dayParts(bars[hv].day);
                  return `${p.wd} ${p.n} ${p.m} · ${bars[hv].count}${bars[hv].count === 1 ? ' event' : ' events'}`;
                })()}
                <span style={{ position: 'absolute', left: '50%', bottom: -4, width: 8, height: 8, background: 'var(--navy)', transform: 'translateX(-50%) rotate(45deg)' }} />
              </span>
            ) : null}
          </div>
          <div className="tb-14">
            {bars.map((b, i) => (
              <span
                key={b.day}
                className="mono"
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  ...(i === bars.length - 1 ? { color: 'var(--navy-ink,var(--navy))', fontWeight: 700 } : { color: 'var(--subtle)' }),
                }}
              >
                {dayParts(b.day).n}
              </span>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="tb-hd">
            <Seg
              tabs={CATS.map((l, i) => ({ label: l, cnt: E.filter((e) => (i === 0 || e.cat === l) && fw(e) && fs(e)).length }))}
              active={tab}
              onPick={setTab}
              label="Filter by type"
            />
            <Seg tabs={['Everyone', 'SBC', companyShort === 'you' ? 'Client' : companyShort].map((l) => ({ label: l }))} active={who} onPick={setWho} label="Filter by who" />
          </div>
          <div style={{ padding: '6px 16px 16px' }}>
            {q.isLoading ? (
              sk ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="tb-ev">
                    <span className="sk" style={{ height: 12 }} />
                    <span className="sk" style={{ width: 28, height: 28, borderRadius: 99 }} />
                    <span className="sk" style={{ height: 12 }} />
                    <span className="sk" style={{ height: 12 }} />
                    <span />
                  </div>
                ))
              ) : null
            ) : q.isError ? (
              <BotBubble padding="40px 16px 24px">
                <div className="rt" style={{ fontWeight: 700 }}>
                  Could not load the audit log.
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="button" className="btn btn-o btn-sm" onClick={() => void q.refetch()}>
                    Try again
                  </button>
                </div>
              </BotBubble>
            ) : days.length === 0 ? (
              <BotBubble padding="40px 16px 24px">
                <div className="rt" style={{ fontWeight: 700 }}>
                  {E.length ? 'Nothing matches these filters yet.' : 'Nothing has happened on the project yet.'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  {E.length ? (
                    <button
                      type="button"
                      className="btn btn-o btn-sm"
                      onClick={() => {
                        setTab(0);
                        setWho(0);
                        setText('');
                      }}
                    >
                      Clear filters
                    </button>
                  ) : null}
                  <AskWhy q="Why is the audit log empty?" />
                </div>
              </BotBubble>
            ) : (
              days.map((d) => {
                const p = dayParts(d.day);
                const isToday = d.day === today;
                return (
                  <div key={d.day} className="tb-day">
                    <div className="tb-dayh">
                      <div
                        className="dtile"
                        style={{
                          width: 60,
                          height: 62,
                          ...(isToday ? { background: 'var(--navy)', color: '#fff' } : { background: 'var(--primary-light)', color: 'var(--navy)' }),
                        }}
                      >
                        <span className="d">{p.n}</span>
                        <span className="m">{p.m}</span>
                      </div>
                      <div className="cap" style={{ textAlign: 'center', width: 60, marginTop: 4, fontWeight: 700 }}>
                        {isToday ? 'Today' : p.wd}
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      {/* the rail joins a day's events; a one-event day has nothing to join */}
                      {d.items.length > 1 ? <span className="tb-vl" /> : null}
                      {d.items.map((e) => {
                        const open = openId === e.id;
                        return (
                          <div key={e.id}>
                            <div className="tb-ev">
                              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy-ink,var(--navy))' }}>
                                {e.time}
                              </span>
                              <Node e={e} company={companyShort} />
                              <div style={{ minWidth: 0 }}>
                                <span className="rt" style={{ fontWeight: 700 }}>
                                  {e.action}
                                </span>
                                <span style={{ color: 'var(--muted)' }}> · {e.subject}</span>
                              </div>
                              <div className="tb-evw" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <span
                                  className="av"
                                  style={{
                                    width: 24,
                                    height: 24,
                                    fontSize: 11,
                                    boxShadow: 'none',
                                    background: e.who.side === 'client' ? 'var(--primary-fill,var(--primary))' : avatarColor(e.who.name),
                                  }}
                                >
                                  {e.who.initials}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.who.name}</span>
                                <span className="chip" style={rc(e.who.side)}>
                                  {e.who.role}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="ibtn"
                                onClick={() => setOpenId(open ? null : e.id)}
                                aria-expanded={open}
                                aria-label="Details"
                              >
                                <Svg d={P.chevron} size={14} join={false} style={open ? { transform: 'rotate(180deg)' } : undefined} />
                              </button>
                            </div>
                            {open ? (
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
                                      className="btn btn-o btn-sm"
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
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
            {q.hasNextPage ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
                <button type="button" className="btn btn-o btn-sm" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
                  {q.isFetchingNextPage ? 'Loading…' : 'Load older'}
                </button>
              </div>
            ) : null}
          </div>
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
      <div
        className="dd-top"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'var(--primary-light)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)' }}
      >
        <span>These events live in the Audit log</span>
        <a
          href="#"
          style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap' }}
          onClick={(e) => {
            e.preventDefault();
            onLink();
          }}
        >
          Show in the Audit log ↓
        </a>
      </div>
      <div className="dlg-h">
        <div className="dtile" style={{ background: 'var(--navy)', color: '#fff' }}>
          <span className="d">{p.n}</span>
          <span className="m">{p.m}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="ab-t" style={{ margin: 0, font: '700 16px Manrope', color: 'var(--navy-ink,var(--navy))' }}>
            {day === today ? 'Today' : p.wd}, {p.n} {p.m}
          </h2>
          <div className="cap">
            {n} {n === 1 ? 'event' : 'events'}
          </div>
        </div>
        <CloseBtn onClick={() => setDd(null)} />
      </div>
      <div style={{ padding: '12px 18px 0' }}>
        <Seg
          tabs={active.map((i) => {
            const x = dayParts(bars[i].day);
            return { label: `${x.n} ${x.m}`, cnt: bars[i].count };
          })}
          active={pos}
          onPick={(k) => setDd(active[k])}
          label="Pick a day"
          btnStyle={{ padding: '0 8px' }}
        />
      </div>
      <div style={{ padding: '8px 0 10px', maxHeight: 'min(420px,52dvh)', overflow: 'auto' }}>
        {q.isLoading ? (
          <div style={{ padding: '10px 18px' }}>
            <div className="sk" style={{ height: 14, width: '70%' }} />
          </div>
        ) : (
          (q.data?.events ?? []).map((e) => (
            <a
              key={e.id}
              href={e.cta?.href ?? '#'}
              className="row"
              style={{ color: 'inherit', fontWeight: 'inherit', padding: '10px 18px' }}
              onClick={(ev) => {
                ev.preventDefault();
                onOpen(e);
              }}
            >
              <span className="mono" style={{ width: 44, fontSize: 12, fontWeight: 600, color: 'var(--navy-ink,var(--navy))' }}>
                {e.time}
              </span>
              <Node e={e} ring={false} company={company} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="rt" style={{ fontWeight: 700 }}>
                  {e.action}
                </span>
                <span style={{ color: 'var(--muted)' }}> · {e.subject}</span>
                <span className="cap tb-m tb-flex" style={{ marginTop: 3, alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{e.who.name}</span>
                  <span className="chip" style={rc(e.who.side)}>
                    {e.who.role}
                  </span>
                </span>
              </span>
              <span className="tb-d" style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {e.who.name}
              </span>
              <span className="chip tb-d" style={rc(e.who.side)}>
                {e.who.role}
              </span>
              <span style={{ color: 'var(--primary)', display: 'flex' }}>
                <Svg d={P.ext} />
              </span>
            </a>
          ))
        )}
      </div>
    </Dialog>
  );
}
