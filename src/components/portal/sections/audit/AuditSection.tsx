'use client';

/**
 * AUDIT (prototype body.txt AUDIT + a6_rest.js renderAudit): the 14-day strip
 * (one tile per day, heat by count, coloured dots by kind; click a day to show
 * only that day), the kind tabs, the SBC / company filter, the grouped log and
 * Export.
 *
 * Real data: GET /api/client/audit?summary=1&limit=60 (client-safe projection of
 * the engagement's audit events; staff by name and role only), older pages with
 * ?before=<iso>, one day with ?day=yyyy-mm-dd; export: /api/client/audit/export
 * (CSV, with the current filters). An event's link navigates inside the portal.
 */
import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AuditCategory, AuditNode, ClientAuditEvent, ClientAuditPage } from '@/lib/client-portal/audit';
import { usePortal } from '../../runtime';
import { getJson, PK } from '../../data';
import { addDays, fmt, fmtL, P, todayIso, WD } from '../../dates';
import { PopHead } from '../../overlays';
import { Btn, Icon, SecError, SecHead, SecLoading, Seg, type IconName } from '../../ui';
import { hrefToIntent } from '../updates/links';
import '../../css/95-audit.css';

const CATS: Array<'all' | AuditCategory> = ['all', 'Documents', 'Milestones', 'Team', 'Email', 'Credentials'];
const CAT_LABEL: Record<(typeof CATS)[number], string> = { all: 'All', Documents: 'Documents', Milestones: 'Steps', Team: 'Team', Email: 'Email', Credentials: 'Credentials' };
/** Dot colour per category (prototype KC). */
const KC: Record<AuditCategory, string> = { Documents: 'var(--due)', Milestones: 'var(--ice)', Team: 'var(--ok-green)', Email: 'var(--law-MCA)', Credentials: 'var(--ink-3)' };
/** Icon tile per node (prototype AIC): [icon, background, colour]. */
const AIC: Record<AuditNode, [IconName, string, string]> = {
  req: ['doc', 'var(--due-bg)', 'var(--due-ink)'],
  back: ['alert', 'var(--over-bg)', 'var(--over-ink)'],
  up: ['up', 'var(--ice-soft)', 'var(--ice)'],
  ok: ['check', 'rgba(52,211,153,.14)', 'var(--ok-green)'],
  time: ['clock', 'var(--ice-soft)', 'var(--ice)'],
  mail: ['mail', 'var(--hi)', 'var(--ink-2)'],
  team: ['team', 'var(--hi)', 'var(--ink-2)'],
};

const AUDIT_KEY = [PK, 'audit'] as const;

function useAudit() {
  return useInfiniteQuery({
    queryKey: AUDIT_KEY,
    initialPageParam: '',
    queryFn: async ({ pageParam }) =>
      (await getJson<ClientAuditPage>(`/api/client/audit?limit=60${pageParam ? `&before=${encodeURIComponent(pageParam)}` : '&summary=1'}`)) ?? { events: [], nextBefore: null },
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    staleTime: 30_000,
  });
}
function useAuditDay(day: string | null) {
  return useQuery({
    queryKey: [PK, 'audit-day', day],
    queryFn: async () => (await getJson<{ events: ClientAuditEvent[] }>(`/api/client/audit?day=${day}`))?.events ?? [],
    enabled: Boolean(day),
    staleTime: 30_000,
  });
}

export function AuditSection() {
  const { shell, openPop, closePop, setIntent, toast } = usePortal();
  const company = shell?.companyShort ?? 'Client';
  const q = useAudit();
  const [cat, setCat] = useState<(typeof CATS)[number]>('all');
  const [who, setWho] = useState<'all' | 'sbc' | 'client'>('all');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const dayQ = useAuditDay(day);
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [text]);

  const today = todayIso();
  const all = useMemo(() => q.data?.pages.flatMap((p) => p.events) ?? [], [q.data]);
  const summary = q.data?.pages[0]?.summary;
  const days = useMemo(() => {
    if (summary?.days.length) return summary.days;
    return Array.from({ length: 14 }, (_, i) => ({ day: addDays(today, i - 13), count: 0, cats: {} }));
  }, [summary, today]);
  const mx = Math.max(1, ...days.map((d) => d.count));

  const source = day ? (dayQ.data ?? []) : all;
  const list = source.filter(
    (e) => (cat === 'all' || e.cat === cat) && (who === 'all' || e.who.side === who) && (!search || `${e.action} ${e.subject} ${e.who.name}`.toLowerCase().includes(search)),
  );
  const groups = useMemo(() => {
    const out: Array<{ day: string; items: ClientAuditEvent[] }> = [];
    for (const e of list) {
      const last = out[out.length - 1];
      if (last && last.day === e.day) last.items.push(e);
      else out.push({ day: e.day, items: [e] });
    }
    return out;
  }, [list]);

  const exportHref = (filtered: boolean) => {
    const p = new URLSearchParams();
    if (filtered) {
      if (cat !== 'all') p.set('cat', cat);
      if (who !== 'all') p.set('who', who);
      if (search) p.set('q', search);
    }
    return `/api/client/audit/export${p.toString() ? `?${p}` : ''}`;
  };
  const download = (href: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
    closePop();
    toast('Download started · audit log (CSV)');
  };
  const filtered = cat !== 'all' || who !== 'all' || Boolean(search);
  const dayLabel = (d: string) => (d === today ? 'TODAY' : d === addDays(today, -1) ? 'YESTERDAY' : fmtL(d).toUpperCase());
  const total = summary?.total ?? 0;

  return (
    <>
      <SecHead title="Audit">
        <Btn
          ico="dl"
          onClick={(e) =>
            openPop(
              e.currentTarget,
              <div>
                <PopHead title="Export" sub={`Audit log · ${total} action${total === 1 ? '' : 's'} in 14 days`} />
                <div className="menu" style={{ marginTop: 8 }}>
                  {filtered ? (
                    <button type="button" onClick={() => download(exportHref(true))}>
                      <Icon name="grid" />
                      With these filters
                      <small>.csv</small>
                    </button>
                  ) : null}
                  <button type="button" onClick={() => download(exportHref(false))}>
                    <Icon name="grid" />
                    The whole log
                    <small>.csv</small>
                  </button>
                </div>
              </div>,
              { kind: 'export' },
            )
          }
        >
          Export
        </Btn>
      </SecHead>

      <section className="glass panel">
        <div className="ph">
          <h3>Last 14 days</h3>
          <span className="sp" />
          <span className="small">
            {summary ? `${total} action${total === 1 ? '' : 's'}` : '—'}
            {day ? ` · showing ${fmt(day)}` : ''}
          </span>
        </div>
        <div className="astrip">
          {days.map((d) => {
            const cats = Object.entries(d.cats ?? {}) as Array<[AuditCategory, number]>;
            return (
              <button
                key={d.day}
                type="button"
                className={'aday' + (d.day === today ? ' today' : '')}
                style={{ ['--heat' as string]: (d.count / mx).toFixed(2) }}
                title={`${fmtL(d.day)}: ${d.count} action${d.count === 1 ? '' : 's'}`}
                aria-pressed={day === d.day}
                onClick={() => setDay(day === d.day ? null : d.day)}
              >
                <span className="wd">{d.day === today ? 'TODAY' : WD[P(d.day).getUTCDay()]!.toUpperCase()}</span>
                <b>{P(d.day).getUTCDate()}</b>
                <span className="ct">{d.count ? `${d.count} action${d.count > 1 ? 's' : ''}` : '—'}</span>
                <span className="kd">
                  {cats.flatMap(([k, n]) => Array.from({ length: Math.min(n, 6) }, (_, i) => <i key={k + i} style={{ background: KC[k] }} />))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="akeys">
          {(Object.keys(KC) as AuditCategory[]).map((k) => (
            <span key={k}>
              <i style={{ background: KC[k] }} />
              {CAT_LABEL[k]}
            </span>
          ))}
        </div>
      </section>

      <div className="ftool" style={{ marginTop: 12 }}>
        <Seg<(typeof CATS)[number]> options={CATS.map((k) => ({ value: k, label: CAT_LABEL[k], n: k === 'all' ? undefined : source.filter((e) => e.cat === k).length || undefined }))} value={cat} onChange={setCat} ariaLabel="Filter by type" />
        <span className="sp" />
        <label className="au-search">
          <Icon name="search" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search" aria-label="Search the audit log" />
        </label>
        <Seg<'all' | 'sbc' | 'client'>
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'sbc', label: 'SBC' },
            { value: 'client', label: company },
          ]}
          value={who}
          onChange={setWho}
          ariaLabel="Filter by who"
        />
      </div>

      <section className="glass panel au-list">
        {q.isPending || (day && dayQ.isPending) ? (
          <SecLoading />
        ) : q.isError ? (
          <SecError message="The audit log could not load." onRetry={() => void q.refetch()} />
        ) : !groups.length ? (
          <div className="sec-empty">
            {source.length ? 'No actions match these filters.' : day ? `Nothing happened on ${fmt(day)}.` : 'Nothing has happened on the project yet.'}
            {filtered || day ? (
              <div style={{ marginTop: 10 }}>
                <Btn
                  cls="sm"
                  onClick={() => {
                    setCat('all');
                    setWho('all');
                    setText('');
                    setDay(null);
                  }}
                >
                  Clear filters
                </Btn>
              </div>
            ) : null}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.day}>
              <div className="ngrp">{dayLabel(g.day)}</div>
              {g.items.map((e) => {
                const [ic, bg, fg] = AIC[e.node];
                const isOpen = open === e.id;
                const intent = e.cta ? hrefToIntent(e.cta.href) : null;
                return (
                  <div key={e.id}>
                    <div className={'ar' + (isOpen ? ' open' : '')} role="button" tabIndex={0} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.id)} onKeyDown={(k) => k.key === 'Enter' && setOpen(isOpen ? null : e.id)}>
                      <span className="tm">{e.time}</span>
                      <span className={'role' + (e.who.side === 'client' ? ' Client' : '')}>{e.who.side === 'sbc' ? 'SBC' : 'CLIENT'}</span>
                      <div className="ev">
                        <i style={{ background: bg, color: fg }}>
                          <Icon name={ic} />
                        </i>
                        <div style={{ minWidth: 0 }}>
                          <b>{e.action} </b>
                          <span>{e.subject}</span>
                        </div>
                      </div>
                      <span className="who">
                        <span className="av" style={{ width: 24, height: 24, fontSize: 10, background: e.who.side === 'client' ? 'linear-gradient(140deg,#d97706,#f2b84b)' : undefined }}>
                          {e.who.initials}
                        </span>
                        <span className="au-name">{e.who.name}</span>
                        <span className="small">· {e.who.role}</span>
                      </span>
                    </div>
                    {isOpen ? (
                      <div className="au-facts">
                        {(e.facts.length ? e.facts : [{ k: 'When', v: `${fmtL(e.day)}, ${e.time}` }]).map((f) => (
                          <div key={f.k}>
                            <span className="eyebrow">{f.k}</span>
                            <b>{f.v}</b>
                          </div>
                        ))}
                        {e.cta && intent ? (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <Btn cls="sm pri" ico="chev" onClick={() => setIntent(intent)}>
                              {e.cta.label}
                            </Btn>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
        {!day && q.hasNextPage ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
            <Btn cls="sm" disabled={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
              {q.isFetchingNextPage ? 'Loading…' : 'Load older'}
            </Btn>
          </div>
        ) : null}
      </section>
    </>
  );
}
