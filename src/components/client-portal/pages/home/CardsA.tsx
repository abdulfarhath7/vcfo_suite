'use client';

/**
 * Home cards shared by both layouts and the before-COI cards:
 * greeting (v7c_greet_b / _a), Needs (v7c_needs_b / _a), Who holds it now
 * (v7c_current), Important alerts (v7c_alerts_b / _a), What SBC is doing
 * (v7c_sbc_b / _a), Recent documents (v7c_docs_b / _a), Recent activity
 * (v7c_activity_b / _a). Markup, class names and inline styles verbatim.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { BotSays } from '@/components/client-portal/shared';
import { VisorHead } from '@/components/client-portal/Visor';
import { LinkButton } from '@/components/client-portal/LinkButton';
import { portalHref, stepHref } from '@/components/client-portal/routes';
import type { DrillConfig, DrillRow } from '@/components/client-portal/PortalProvider';
import type { PortalStep } from '@/lib/client-portal/step-model';
import { CardHead, Ico, InfoPopover, Seg, Tip, ownerChipStyle, useDownload } from './ui';
import type { HomeData } from './useHome';
import {
  alertsDrill,
  chipBg,
  dHeader,
  dLong,
  dShort,
  dayMon,
  days,
  docGroup,
  FT_STYLE,
  needChip,
  NEED_TABS,
  postIncDrill,
  solid,
  spiceStepsDrill,
  type AlertRow,
  type DocItem,
  type NeedRow,
} from './derive';

const S = { fontFamily: 'var(--font-sans),system-ui,sans-serif', color: 'var(--fg)', fontSize: 13 } as const;

/* ------------------------------------------------------------------ greet */

export function overdueCount(h: HomeData): number {
  const ids = new Set<string>();
  for (const n of h.needs) if (n.due && n.due < h.today) ids.add(n.stepId ?? n.key);
  for (const s of h.model.steps) if (s.late && s.kind !== 'done') ids.add(s.id);
  if (h.after) return ids.size + h.buckets.overdue;
  return ids.size;
}

export function GreetCard({ h }: { h: HomeData }) {
  const { portal, after, model, company } = h;
  const post = model.phases[2];
  const ring = after
    ? { pct: post && post.total ? Math.round((post.done / post.total) * 100) : 0, label: 'SETUP', tip: `Setup · ${post?.done ?? 0} of ${post?.total ?? 0} done` }
    : { pct: model.spice.pct, label: 'SPICE+', tip: `Incorporation · ${model.spice.done} of ${model.spice.total} SPICe+ steps` };
  const openRing = () =>
    portal.drill(after ? postIncDrill(h.post.open, h.post.done, 1) : spiceStepsDrill(model, company, 0));
  const regsDone = h.regs.filter((r) => r.status === 'Registered').length;
  const stats: { v: string | number; label: string; color?: string }[] = after
    ? [
        { v: h.needs.length, label: `Waiting on ${company}`, color: 'oklch(86% 0.09 60)' },
        { v: overdueCount(h), label: 'Overdue', color: 'oklch(84% 0.09 20)' },
        { v: h.buckets.dueSoon, label: 'Due soon', color: 'oklch(86% 0.09 60)' },
        { v: `${regsDone}/${h.regs.length}`, label: 'Registrations' },
        ...(h.overview?.engagement.incorporationDate ? [{ v: dShort(h.overview.engagement.incorporationDate), label: 'Incorporated' }] : []),
      ]
    : [
        { v: h.needs.length, label: `Waiting on ${company}`, color: 'oklch(86% 0.09 60)' },
        { v: model.counts.with, label: 'With SBC' },
        { v: overdueCount(h), label: 'Overdue', color: 'oklch(84% 0.09 20)' },
        ...(h.home && h.home.requestCounts.total > 0 ? [{ v: `${h.home.requestCounts.fulfilled}/${h.home.requestCounts.total}`, label: 'Documents in' }] : []),
        ...(model.coiExpected ? [{ v: dShort(model.coiExpected), label: 'Expected COI' }] : []),
      ];
  return (
    <div style={{ width: '100%', boxSizing: 'border-box', ...S }}>
      <section
        className="vh-greet"
        style={{ position: 'relative', borderRadius: 10, padding: '12px clamp(14px,2vw,18px) 10px', background: 'linear-gradient(115deg,var(--navy-deep,var(--navy)) 0%,var(--navy-2-deep,var(--navy-2)) 60%,var(--navy-3-deep,var(--navy-3)) 100%)', color: '#fff', overflow: 'hidden' }}
      >
        <div className="vh-gtop" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 11, opacity: 0.65 }}>{dHeader(h.today)}</div>
            <h1 className="metric" style={{ margin: '2px 0 0', fontSize: 'clamp(19px,calc(15px + 0.6vw),24px)', lineHeight: 1.15, color: '#fff' }}>{h.companyName}</h1>
          </div>
          {h.engagementId ? (
            <a
              className="btn"
              href={`/api/ask/brief?engagementId=${encodeURIComponent(h.engagementId)}`}
              download
              aria-label="Report"
              onClick={() => portal.toast(`Preparing ${company}’s progress report (PDF)…`)}
              style={{ height: 30, padding: '0 10px', background: 'oklch(100% 0 0 / 0.12)', color: '#fff', borderColor: 'oklch(100% 0 0 / 0.28)' }}
            >
              <Ico n="download" />
              <span className="vh-hide-xs">Report</span>
            </a>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Tip
              tip={ring.tip}
              variant="l w"
              onOpen={openRing}
              style={{ width: 46, height: 46, borderRadius: 99, background: `conic-gradient(var(--gold) 0 ${ring.pct}%,oklch(100% 0 0 / 0.16) ${ring.pct}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ width: 37, height: 37, borderRadius: 99, background: 'var(--navy-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '600 11px var(--font-sans)' }}>{ring.pct}%</div>
            </Tip>
            <span style={{ fontSize: 11, letterSpacing: '.1em', opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap' }}>{ring.label}</span>
          </div>
        </div>
        <div style={{ height: 1, background: 'oklch(100% 0 0 / 0.14)', margin: '8px 0 7px' }} />
        <div className="vh-stats" style={{ display: 'flex', flexWrap: 'wrap' }}>
          {stats.map((s) => (
            <div key={s.label} className="vh-stat" style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingRight: 16, marginRight: 16, borderRight: '1px solid oklch(100% 0 0 / 0.14)' }}>
              <span className="metric" style={{ fontSize: 18, lineHeight: 1, color: s.color ?? '#fff' }}>{s.v}</span>
              <span style={{ fontSize: 11.5, opacity: 0.75 }}>{s.label}</span>
            </div>
          ))}
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)' }} />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ needs */

export function NeedsCard({ h, onUpload }: { h: HomeData; onUpload: (n: NeedRow) => void }) {
  const [tab, setTab] = useState(0);
  const kind = NEED_TABS[tab]![0];
  const rows = h.needs.filter((n) => n.kind === kind);
  const verb = NEED_TABS[tab]![1];
  const act = (n: NeedRow) => {
    if (n.kind === 'upload' && n.requestId) onUpload(n);
    else if (n.href) h.portal.go(n.href);
  };
  return (
    <div style={{ width: '100%', boxSizing: 'border-box', ...S }}>
      <section className="card">
        <CardHead title={`Needs from ${h.company}`} />
        <div style={{ padding: '12px 16px 14px' }}>
          <Seg full label={`Needs from ${h.company}`} value={tab} onChange={setTab} tabs={NEED_TABS.map(([k, l]) => ({ label: l, cnt: h.needs.filter((n) => n.kind === k).length }))} />
          <div style={{ marginTop: 8 }}>
            {rows.map((n) => {
              const chip = needChip(h.today, n.due, h.after);
              return (
                <div key={n.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--hair)' }}>
                  <span className="box" style={{ width: 18, height: 18 }} />
                  <div style={{ flex: 1 }}>
                    <div className="rt" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {n.title}
                      <InfoPopover askAbout={n.title}>
                        {n.sub}
                        {n.askedBy ? ` · asked by ${n.askedBy}` : ''}
                      </InfoPopover>
                    </div>
                  </div>
                  {chip ? (
                    <span className="chip" style={solid(chip.tone)}>
                      {chip.label}
                    </span>
                  ) : null}
                  <a
                    className="btn btn-o"
                    href={n.href ?? '#'}
                    onClick={(e) => {
                      e.preventDefault();
                      act(n);
                    }}
                    style={{ height: 30, minWidth: 76, justifyContent: 'center', padding: '0 10px', fontSize: 12 }}
                  >
                    {n.kind === 'upload' ? 'Upload' : n.kind === 'fill' ? 'Fill' : n.kind === 'correct' ? 'Correct' : 'Sign'}
                  </a>
                </div>
              );
            })}
            {rows.length === 0 ? (
              <div style={{ padding: '10px 0', borderTop: '1px solid var(--hair)' }}>
                <BotSays size={40} question={`Why is there nothing to ${verb.toLowerCase()}?`}>
                  Nothing to {verb.toLowerCase()} right now. You are all caught up here.
                </BotSays>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------- who holds it now */

const BOX: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' };

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? '' : 's'}`;
}

export function CurrentCard({ h, onStep }: { h: HomeData; onStep: (s: PortalStep) => void }) {
  const { model, company, portal, lead } = h;
  const [tab, setTab] = useState(0);
  const spice = model.steps.filter((s) => s.phaseNo <= 2);
  const groups = {
    client: spice.filter((s) => s.kind === 'you' || s.kind === 'prog'),
    sbc: model.steps.filter((s) => s.kind === 'with' && s.owner === 'sbc' && s.phaseNo <= 2),
    mca: model.steps.filter((s) => s.kind === 'with' && s.owner === 'mca'),
  };
  const counts = {
    done: spice.filter((s) => s.kind === 'done').length,
    you: spice.filter((s) => s.kind === 'you').length,
    prog: spice.filter((s) => s.kind === 'prog' || s.kind === 'with').length,
    up: spice.filter((s) => s.kind === 'up' || s.kind === 'next').length,
  };
  const drill = (active: number) => portal.drill(spiceStepsDrill(model, company, active));
  const statusOf = (s: PortalStep): { label: string; tone: 'ok' | 'due' | 'prog' | 'up'; tip: string; tab: number } =>
    s.kind === 'done'
      ? { label: 'Completed', tone: 'ok', tip: `Completed · ${plural(counts.done, 'step')}`, tab: 1 }
      : s.kind === 'you'
        ? { label: 'Waiting', tone: 'due', tip: `Waiting for ${company} · ${plural(counts.you, 'step')}`, tab: 3 }
        : s.kind === 'prog' || s.kind === 'with'
          ? { label: 'In progress', tone: 'prog', tip: `In progress · ${plural(counts.prog, 'step')}`, tab: 2 }
          : { label: 'Not started', tone: 'up', tip: `Not started · ${plural(counts.up, 'step')}`, tab: 4 };
  const missing = (s: PortalStep) => h.needs.filter((n) => n.stepId === s.id && n.kind === 'upload').length;
  const holders = (tab === 0 ? groups.client : tab === 1 ? groups.sbc : groups.mca).map((s, i) => {
    const st = statusOf(s);
    const waiting = s.kind === 'you';
    const m =
      s.owner === 'client'
        ? waiting
          ? `Step ${s.n}${s.due ? ` · due ${dShort(s.due)}` : ''}${missing(s) ? ` · ${plural(missing(s), 'file')} missing` : ''}`
          : `Step ${s.n} · ${company} fills this`
        : `Step ${s.n}${lead ? ` · ${lead}` : ''}${s.due ? ` · ready ${dShort(s.due)}` : ''}`;
    return { s, st: waiting ? { ...st, label: `Waiting for ${company}` } : st, m, primary: tab === 0 && i === 0, cta: s.owner === 'client' ? 'Continue' : 'Open' };
  });
  // steps around the client: one done step before the current block, through one upcoming after it
  const around = useMemo(() => {
    const idx = spice.findIndex((s) => s.kind !== 'done');
    if (idx < 0) return spice.slice(-3);
    let end = spice.findIndex((s, i) => i > idx && (s.kind === 'up' || s.kind === 'next'));
    if (end < 0) end = spice.length - 1;
    return spice.slice(Math.max(0, idx - 1), Math.min(end + 1, idx + 7));
  }, [spice]);
  const filing = model.byId['pre-10'];
  return (
    <div style={{ width: '100%', boxSizing: 'border-box', ...S }}>
      <section className="card">
        <CardHead title="Who holds it now" />
        <div style={{ padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Seg
            full
            label="Who holds it now"
            value={tab}
            onChange={setTab}
            tabs={[
              { label: company, cnt: groups.client.length },
              { label: 'SBC', cnt: groups.sbc.length },
              { label: 'MCA', cnt: groups.mca.length },
            ]}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {holders.map(({ s, st, m, primary, cta }) => (
              <div key={s.id} style={{ ...BOX, borderLeft: `3px solid var(--${st.tone === 'due' ? 'due' : 'prog'})` }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <LinkButton className="rt" onClick={() => onStep(s)} style={{ color: 'inherit', ...(primary ? { fontWeight: 800 } : { fontWeight: 600 }) }}>
                      {s.title}
                    </LinkButton>
                    <Tip tip={st.tip} onOpen={() => drill(st.tab)} style={{ display: 'inline-flex' }}>
                      <span className="chip" style={solid(st.tone === 'due' ? 'due' : 'prog')}>
                        {st.label}
                      </span>
                    </Tip>
                  </div>
                  <div className="cap" style={{ marginTop: 2 }}>{m}</div>
                </div>
                <a
                  className={primary ? 'btn btn-p' : 'btn btn-o'}
                  href={stepHref(s.id)}
                  onClick={(e) => {
                    e.preventDefault();
                    portal.go(stepHref(s.id));
                  }}
                  style={{ height: 30, padding: '0 10px', fontSize: 12, flex: 'none' }}
                >
                  {cta}
                </a>
              </div>
            ))}
            {holders.length === 0 ? (
              <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px dashed var(--border)', borderRadius: 8, background: 'var(--raised)' }}>
                <span style={{ width: 28, height: 28, display: 'inline-flex', overflow: 'hidden', flex: 'none' }} aria-hidden="true">
                  <VisorHead style={{ width: 24, height: 30, margin: '2px auto 0' }} />
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--fg)' }}>
                  {tab === 2
                    ? `Nothing is with MCA yet.${filing?.due && filing.kind !== 'done' ? ` SBC files SPICe+ on ${dShort(filing.due)}, then MCA reviews it.` : ''}`
                    : tab === 1
                      ? 'Nothing is with SBC right now.'
                      : `Nothing is waiting on ${company} right now.`}
                </span>
              </div>
            ) : null}
          </div>
          <div>
            <div className="lbl" style={{ color: 'var(--navy-ink,var(--navy))', marginBottom: 2 }}>Steps around {company}</div>
            {around.map((s) => {
              const st = statusOf(s);
              const cur = s.id === model.current?.id;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--hair)' }}>
                  <span className="mono cap" style={{ width: 50, flex: 'none' }}>Step {s.n}</span>
                  <LinkButton className="rt" onClick={() => onStep(s)} style={{ flex: 1, color: st.tone === 'up' ? 'var(--muted)' : 'inherit', fontWeight: cur ? 800 : 600 }}>
                    {s.title}
                  </LinkButton>
                  <span className="chip" style={ownerChipStyle(s.owner === 'client' ? 'client' : 'sbc')}>
                    {s.owner === 'client' ? company : 'SBC'}
                  </span>
                  <Tip tip={st.tip} onOpen={() => drill(st.tab)} style={{ display: 'inline-flex' }}>
                    <span className="chip" style={{ ...solid(st.tone), minWidth: 108, justifyContent: 'center' }}>
                      {st.label}
                    </span>
                  </Tip>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- alerts */

export function AlertsCard({ h }: { h: HomeData }) {
  const { hero, rows } = h.alerts;
  const [tab, setTab] = useState(h.after ? 1 : 0);
  const n15 = rows.filter((a) => days(h.today, a.date) <= 15).length;
  const n30 = rows.filter((a) => days(h.today, a.date) <= 30).length;
  const win = tab === 0 ? 15 : 30;
  const list = rows.filter((a) => days(h.today, a.date) <= win);
  const open = (active: number) => h.portal.drill({ ...alertsDrill(hero, rows, h.today, h.after), active });
  const tile = (a: AlertRow): CSSProperties => ({ position: 'relative', width: 44, height: 48, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: 'none', background: `var(--${a.tone})` });
  return (
    <div style={{ width: '100%', boxSizing: 'border-box', ...S }}>
      <section className="card">
        <CardHead
          title="Important alerts"
          right={<Seg label="Important alerts window" value={tab} onChange={setTab} tabs={[{ label: '15 days', cnt: n15 }, { label: '30 days', cnt: n30 }]} />}
        />
        <div style={{ padding: '10px 16px 12px' }}>
          {hero ? (
            <Tip
              tip={`${hero.title.replace(/ (sent back|is late|overdue.*)$/, '')} · overdue ${plural(Math.max(1, days(hero.date, h.today)), 'day')}`}
              onOpen={() => open(1)}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 14px', padding: '12px 14px', borderRadius: 8, background: 'var(--over-light)', border: '1px solid oklch(57% 0.2 22 / 0.3)', marginBottom: 6 }}
            >
              <Ico n="octagon" size={22} style={{ color: 'var(--over-text)' }} />
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ display: 'flex', gap: '6px 8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="rt" style={{ fontSize: 14 }}>{hero.title}</span>
                  <InfoPopover askAbout={hero.title}>{hero.meta}</InfoPopover>
                  <span className="chip" style={solid('over')}>Overdue</span>
                </div>
              </div>
              <a
                className="btn btn-p"
                href={hero.href}
                onClick={(e) => {
                  e.preventDefault();
                  h.portal.go(hero.href);
                }}
                style={{ height: 30, padding: '0 10px', fontSize: 12, marginLeft: 'auto' }}
              >
                {hero.action ?? 'Open'}
              </a>
            </Tip>
          ) : null}
          {list.map((a) => {
            const [day, mon] = dayMon(a.date);
            const inner = (
              <>
                <span className="metric" style={{ fontSize: 18, lineHeight: 1, color: '#fff' }}>{day}</span>
                <span style={{ fontSize: 11, fontWeight: 800 }}>{mon}</span>
              </>
            );
            return (
              <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid var(--hair)' }}>
                {h.after ? (
                  <Tip tip={`${a.title} · ${day} ${mon}`} onOpen={() => open(days(h.today, a.date) <= 15 ? 2 : 3)} style={tile(a)}>
                    {inner}
                  </Tip>
                ) : (
                  <div style={tile(a)}>{inner}</div>
                )}
                <div style={{ flex: 1 }}>
                  <div className="rt" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <a
                      href={a.href}
                      onClick={(e) => {
                        e.preventDefault();
                        h.portal.go(a.href);
                      }}
                      style={{ color: 'inherit', fontWeight: 600 }}
                    >
                      {a.title}
                    </a>
                    <InfoPopover askAbout={a.title}>{a.meta}</InfoPopover>
                  </div>
                </div>
                <span className="chip" style={{ width: 92, justifyContent: 'center', ...solid(a.tone) }}>
                  {days(h.today, a.date) === 0 ? 'Today' : `In ${plural(days(h.today, a.date), 'day')}`}
                </span>
              </div>
            );
          })}
          {!hero && list.length === 0 ? (
            <div style={{ paddingTop: 6 }}>
              <BotSays size={40} action="">
                Nothing dated in the next {win} days. I will flag anything new here.
              </BotSays>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------- SBC is doing */

export interface SbcRow {
  key: string;
  title: string;
  info: string;
  pct: number | null;
  ready?: string;
  href: string;
  linkLabel: string;
}

export function buildSbcRows(h: HomeData): SbcRow[] {
  const work = h.home?.work ?? [];
  if (work.length) {
    return work.map((w) => {
      const step = w.stepId ? h.model.byId[w.stepId] : undefined;
      return {
        key: w.id,
        title: w.title,
        info: [w.assigneeName ?? h.lead, step ? `Step ${step.n}` : 'SBC', w.readyOn ? `ready ${dShort(w.readyOn)}` : ''].filter(Boolean).join(' · '),
        pct: w.progressPct,
        ready: w.readyOn,
        href: step ? stepHref(step.id) : portalHref('incorporation'),
        linkLabel: step ? `Open Step ${step.n}` : 'Open Incorporation',
      };
    });
  }
  // No work items recorded yet: the steps the firm holds now (no % — not stored).
  return h.model.steps
    .filter((s) => s.kind === 'with' && s.owner !== 'client')
    .slice(0, 6)
    .map((s) => ({
      key: s.id,
      title: s.title,
      info: [h.lead, s.phaseNo === 4 ? 'Registrations' : `Step ${s.n}`, s.due ? `ready ${dShort(s.due)}` : ''].filter(Boolean).join(' · '),
      pct: null,
      ready: s.due,
      href: stepHref(s.id),
      linkLabel: s.phaseNo === 4 ? 'Open Registrations' : `Open Step ${s.n}`,
    }));
}

function sbcDrill(rows: SbcRow[], active: number, lead?: string): DrillConfig {
  const r = (x: SbcRow): DrillRow => ({ title: x.title, meta: x.pct ? `${x.pct}%${lead ? ` · ${lead}` : ''}` : x.pct === 0 ? 'Not started yet' : x.ready ? `ready ${dShort(x.ready)}` : 'With SBC', chip: x.pct === 0 ? 'Not started' : 'In progress', chipColor: chipBg(x.pct === 0 ? 'up' : 'prog'), href: x.href });
  return {
    title: 'What SBC is doing',
    active,
    tabs: [
      { label: 'In progress', rows: rows.filter((x) => x.pct !== 0).map(r) },
      { label: 'Not started', rows: rows.filter((x) => x.pct === 0).map(r) },
    ],
    link: { lead: 'These items live in Incorporation', text: 'Open Incorporation →', href: portalHref('incorporation'), where: 'Incorporation' },
  };
}

export function SbcCard({ h }: { h: HomeData }) {
  const rows = buildSbcRows(h);
  return (
    <div style={{ width: '100%', boxSizing: 'border-box', ...S }}>
      <section className="card">
        <CardHead title="What SBC is doing" />
        <div style={{ padding: '6px 16px 12px' }}>
          {rows.map((r) => (
            <div key={r.key} style={{ padding: '9px 0', borderTop: '1px solid var(--hair)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="rt" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {r.title}
                  <InfoPopover askAbout={r.title}>{r.info}</InfoPopover>
                </span>
                {r.pct != null ? <span className="pct">{r.pct}%</span> : null}
                <a
                  href={r.href}
                  onClick={(e) => {
                    e.preventDefault();
                    h.portal.go(r.href);
                  }}
                  aria-label={r.linkLabel}
                  title={r.linkLabel}
                  style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
                >
                  <Ico n="link" size={13} sw={2} />
                </a>
              </div>
              <div style={{ marginTop: 6 }}>
                <Tip
                  tip={`${r.title}${r.pct != null ? ` · ${r.pct}%` : ''}${r.ready ? ` · ready ${dShort(r.ready)}` : ''}`}
                  onOpen={() => h.portal.drill(sbcDrill(rows, r.pct === 0 ? 1 : 0, h.lead))}
                  style={{ display: 'block' }}
                >
                  <div className="bar" style={{ height: 6 }}>
                    <span style={{ width: `${r.pct ?? 100}%`, background: r.pct === 0 ? 'var(--up)' : r.pct == null ? 'var(--prog-light)' : 'var(--prog)' }} />
                  </div>
                </Tip>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div style={{ paddingTop: 6 }}>
              <BotSays size={40} action="">
                SBC has nothing open for {h.company} right now.
              </BotSays>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* --------------------------------------------------------- recent docs */

export function DocsCard({ h, onOpen }: { h: HomeData; onOpen: (i: number) => void }) {
  const download = useDownload();
  let last = '';
  return (
    <div style={{ width: '100%', boxSizing: 'border-box', ...S }}>
      <section className="card">
        <CardHead
          title="Recent documents"
          right={
            <a
              href={portalHref('documents')}
              onClick={(e) => {
                e.preventDefault();
                h.portal.go('documents');
              }}
              style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Documents <Ico n="arrow" size={12} sw={2} />
            </a>
          }
        />
        <div style={{ padding: '10px 16px 14px' }}>
          {h.docs.map((d: DocItem, i) => {
            const g = docGroup(h.today, d.date);
            const head = g !== last ? (
              <p className="rd-g" key={`g-${g}`}>
                {g}
              </p>
            ) : null;
            last = g;
            const who = d.from === 'client' ? h.company : 'SBC';
            return [
              head,
              <div
                key={d.id}
                className="rd-r"
                tabIndex={0}
                role="button"
                title={`${d.name} · ${d.type} · ${dLong(d.date)} · from ${who}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.rd-b')) return;
                  onOpen(i);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(i);
                  }
                }}
              >
                <span className="rd-ft" style={FT_STYLE[d.type] ?? { background: 'var(--raised)', color: 'var(--muted)' }} aria-hidden="true">
                  {d.type}
                </span>
                <span className="rd-n">{d.name}</span>
                <span className="rd-s">
                  <span className={`rd-who${d.from === 'client' ? ' rd-me' : ''}`}>{who}</span>
                  <span className="rd-sep">&middot;</span>
                  <span className="rd-d">{dShort(d.date)}</span>
                </span>
                <span className="rd-a">
                  <button type="button" className="rd-b" title="Download" aria-label={`Download ${d.name}`} onClick={() => void download(d)}>
                    <Ico n="download" size={15} sw={1.8} />
                  </button>
                </span>
              </div>,
            ];
          })}
          {h.docs.length === 0 ? (
            <BotSays size={40} action="">
              No documents yet. Files from {h.company} and SBC show up here.
            </BotSays>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ activity */

export function ActivityCard({ h }: { h: HomeData }) {
  const [tab, setTab] = useState(0);
  const all = h.home?.activity ?? [];
  const firm = all.filter((a) => a.actorKind === 'firm');
  const client = all.filter((a) => a.actorKind === 'client');
  const rows = tab === 0 ? all : tab === 1 ? firm : client;
  return (
    <div style={{ width: '100%', boxSizing: 'border-box', ...S }}>
      <section className="card">
        <CardHead
          title="Recent activity"
          right={
            <Seg
              label="Who did it"
              value={tab}
              onChange={setTab}
              tabs={[
                { label: 'All', cnt: all.length },
                { label: 'SBC', cnt: firm.length },
                { label: h.company, cnt: client.length },
              ]}
            />
          }
        />
        <div style={{ padding: '6px 16px 12px' }}>
          {rows.map((a) => (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--hair)' }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{dLong(a.at.slice(0, 10))}</span>
              <span className="rt" style={{ fontWeight: 600 }}>{a.label}</span>
              <span className="cap">{a.actorKind === 'client' ? h.company : a.actorName}</span>
            </div>
          ))}
          {rows.length === 0 ? (
            <div style={{ paddingTop: 6 }}>
              <BotSays size={40} action="">
                Nothing here yet.
              </BotSays>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
