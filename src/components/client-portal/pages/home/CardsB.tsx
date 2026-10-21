'use client';

/**
 * Home cards: Timeline (v7c_timeline_b / _a), Steps (v7c_steps_b / _a) and the
 * after-COI cards What is next (v7c_next), Compliance status (v7c_comp),
 * Company IDs (v7c_ids), Compliance by area (v7c_area), Registrations
 * (v7c_reg), Post-incorporation setup (v7c_postinc).
 */
import { useState, type CSSProperties, type MouseEvent } from 'react';
import { BotSays } from '@/components/client-portal/shared';
import { LinkButton } from '@/components/client-portal/LinkButton';
import { phaseHref, portalHref, stepHref } from '@/components/client-portal/routes';
import type { DrillConfig } from '@/components/client-portal/PortalProvider';
import type { HomeFiling } from '@/lib/client/client-home';
import { useRevealedIdentifier } from '@/components/client-portal/pages/credentials/IdsRevealDialog';
import { CardHead, Ico, InfoPopover, Seg, Tip, copyText, ownerChipStyle } from './ui';
import type { HomeData } from './useHome';
import {
  AREA_NAME,
  AREA_ORDER,
  BUCKET_LABEL,
  BUCKET_TONE,
  BUCKETS,
  bucketOf,
  dLong,
  dShort,
  dayMon,
  days,
  filingName,
  filingRow,
  groupOf,
  postIncDrill,
  REG_CATS,
  solid,
  stepStatus,
  stepTimelineText,
  timelineAxis,
  timelineDrill,
  type FilingBucket,
  type RegRow,
  type TlPhase,
} from './derive';

const S = { fontFamily: 'Manrope,system-ui,sans-serif', color: 'var(--fg)', fontSize: 13 } as const;
const W = { width: '100%', boxSizing: 'border-box', ...S } as CSSProperties;

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? '' : 's'}`;
}

/* Rule 15's ↗ portal links are phone-only (mobile.html); the desktop board has none (HM-13). */

/* --------------------------------------------------------------- timeline */

export function TimelineCard({
  h,
  phases,
  onEdit,
  animate,
}: {
  h: HomeData;
  phases: TlPhase[] | null;
  onEdit: () => void;
  animate?: boolean;
}) {
  const t = h.home?.timeline;
  const pending = t?.pending;
  const info = t?.lastChangedBy && t.lastChangedAt ? `Last changed by ${t.lastChangedBy} on ${dLong(t.lastChangedAt.slice(0, 10))}` : 'Planned dates for each phase. The red line is today.';
  const right = h.after ? (
    <span className="chip" style={{ background: 'var(--ok-light)', color: 'var(--ok-text)' }}>Completed</span>
  ) : (
    <>
      {pending ? (
        <button
          type="button"
          className="tle-pend"
          aria-label={`Change request pending, waiting for ${h.manager ?? 'your project manager'}`}
          onClick={() => h.portal.toast(`Waiting for ${h.manager ?? 'your project manager'} to approve · “${pending.reason.slice(0, 60)}”`)}
        >
          Change request pending{pending.coiTo ? ` · COI ${dShort(pending.coiTo)}` : ''}
        </button>
      ) : null}
      {phases ? (
        <LinkButton className="btn btn-o hover:!text-[color:var(--primary-dark)]" onClick={() => onEdit()} style={{ height: 30, padding: '0 10px', fontSize: 12 }}>
          <Ico n="pencil" size={13} />
          Edit
        </LinkButton>
      ) : null}
    </>
  );
  if (!phases) {
    return (
      <div style={W}>
        <section className="card">
          <CardHead title="Timeline" info={info} right={right} />
          <div style={{ padding: '12px 16px 16px' }}>
            <BotSays size={40} question="When will SBC plan the incorporation dates?">
              SBC has not planned the dates yet. They show here as soon as the project manager sets them.
            </BotSays>
          </div>
        </section>
      </div>
    );
  }
  const axis = timelineAxis(phases, h.today);
  const pct = (iso: string) => (days(axis.t0, iso) / axis.span) * 100;
  const todayPct = pct(h.today);
  const coi = phases[3]!;
  const colors: Record<TlPhase['id'], string> = h.after
    ? { p1: 'var(--ok)', p2: 'var(--ok)', mca: 'var(--ok)', coi: 'var(--navy)' }
    : { p1: phases[0]!.done ? 'var(--ok)' : 'var(--prog)', p2: phases[1]!.done ? 'var(--ok)' : 'var(--prog)', mca: phases[2]!.done ? 'var(--ok)' : 'var(--up)', coi: 'var(--navy)' };
  const tipOf = (p: TlPhase) =>
    p.id === 'coi'
      ? h.after
        ? `COI · ${dShort(p.from)}`
        : `COI · expected ${dShort(p.from)}`
      : `${p.name} · ${dShort(p.from)} – ${dShort(p.to)}${p.done ? (p.id === 'p2' ? ' · filed' : ' · done') : p.pct != null ? ` · ${p.pct}%` : ''}`;
  const capOf = (p: TlPhase) =>
    p.id === 'p1' ? (p.done ? `Done ${dShort(p.to)}` : '') : p.id === 'p2' ? (p.done ? `Filed ${dShort(p.to)}` : `${p.pct ?? 0}%`) : p.id === 'coi' ? dShort(p.from) : '';
  const tr: CSSProperties = animate ? { transition: 'left .5s cubic-bezier(.22,1,.36,1), width .5s cubic-bezier(.22,1,.36,1)' } : {};
  return (
    <div style={W}>
      <section className="card">
        <CardHead title="Timeline" info={info} right={right} />
        <div className="vh-tl" style={{ padding: '12px 16px 30px' }}>
          <div style={{ position: 'relative', minWidth: 600 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)' }}>
              <span />
              <div style={{ position: 'relative', height: 18 }}>
                {axis.ticks.map((k) => (
                  <span key={k.iso} className="mono cap" style={{ position: 'absolute', left: `${k.pct}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                    {dShort(k.iso)}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 150, right: 0, top: 0, bottom: 0 }}>
                {axis.ticks.map((k) => (
                  <span key={k.iso} style={{ position: 'absolute', left: `${k.pct}%`, top: 0, bottom: 0, width: 1, background: 'var(--hair)' }} />
                ))}
                {todayPct >= 0 && todayPct <= 100 ? (
                  <>
                    <span style={{ position: 'absolute', left: `${todayPct}%`, top: -4, bottom: 0, width: 2, background: 'var(--over)' }} />
                    <span className="chip" style={{ position: 'absolute', left: `${todayPct}%`, bottom: -20, transform: 'translateX(-50%)', background: 'var(--over-chip)', color: '#fff', padding: '0 6px' }}>
                      Today {dShort(h.today)}
                    </span>
                  </>
                ) : todayPct > 100 ? (
                  <span className="chip" style={{ position: 'absolute', right: 0, bottom: -20, background: 'var(--over-chip)', color: '#fff', padding: '0 6px' }}>
                    Today {dShort(h.today)} →
                  </span>
                ) : null}
              </div>
              {phases.map((p, i) => {
                const left = pct(p.from);
                const width = p.milestone ? 1.76 : Math.max(0.5, pct(p.to) - left);
                return (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', alignItems: 'center', height: 30 }}>
                    <span className="rt" style={{ fontSize: 12, whiteSpace: 'normal', lineHeight: 1.2, paddingRight: 8 }}>{p.name}</span>
                    <div style={{ position: 'relative', height: 30 }}>
                      <Tip
                        tip={tipOf(p)}
                        label={p.id === 'coi' ? 'COI' : p.name.split(' · ')[0]}
                        onOpen={() => h.portal.drill(timelineDrill(h.model, i))}
                        style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 5, bottom: 5, borderRadius: 4, background: colors[p.id], ...tr }}
                      />
                      <span className="cap" style={{ position: 'absolute', left: `calc(${left + width}% + 8px)`, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, whiteSpace: 'nowrap', ...tr }}>
                        {capOf(p)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ steps */

export function StepsCard({ h }: { h: HomeData }) {
  const { model, company, portal } = h;
  const openNo = (model.current?.phaseNo ?? model.phases.find((p) => p.state !== 'done')?.no) ?? 1;
  return (
    <div style={W}>
      <section className="card">
        <CardHead
          title="Steps"
          right={
            <a
              href={portalHref('incorporation')}
              onClick={(e) => {
                e.preventDefault();
                portal.go('incorporation');
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Open Incorporation <Ico n="arrow" size={14} sw={2} />
            </a>
          }
        />
        <div style={{ padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {model.phases.map((ph) => {
            const tone = ph.state === 'done' ? 'ok' : ph.state === 'active' ? 'prog' : 'up';
            return (
              <details key={ph.id} className="stp-g" open={ph.no === openNo}>
                <summary>
                  <svg className="stp-cv" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                  <span className="rt" style={{ flex: 1 }}>
                    <a
                      href={phaseHref(ph.no)}
                      className="stp-ph"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        portal.go(phaseHref(ph.no));
                      }}
                    >
                      Phase {ph.no} · {ph.name}
                    </a>
                  </span>
                  <span className="chip" style={{ ...solid(tone), minWidth: 116, justifyContent: 'center' }}>
                    {ph.done} of {ph.total}
                  </span>
                  <span className="mono cap">{ph.state === 'done' ? 'done' : ph.state === 'active' ? 'in progress' : 'upcoming'}</span>
                </summary>
                <div className="vh-x" style={{ '--tmin': '560px' } as CSSProperties}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Step</th>
                        <th>Owner</th>
                        <th>Status</th>
                        <th>Timeline</th>
                        <th style={{ width: 34 }}>
                          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ph.steps.map((s) => {
                        const [label, t] = stepStatus(s);
                        return (
                          <tr key={s.id} className="stp-row" onClick={() => portal.go(stepHref(s.id))}>
                            <td className="mono cap" style={{ padding: '6px 8px', fontWeight: 600 }}>{s.n}</td>
                            <td className="rt" style={{ padding: '6px 8px', fontSize: 12.5 }}>{s.title}</td>
                            <td style={{ padding: '6px 8px' }}>
                              <span className="chip" style={ownerChipStyle(s.owner === 'client' ? 'client' : 'sbc')}>{s.owner === 'client' ? company : 'SBC'}</span>
                            </td>
                            <td style={{ padding: '6px 8px' }}>
                              <span className="chip" style={{ ...solid(t), minWidth: 116, justifyContent: 'center' }}>{label}</span>
                            </td>
                            <td className="stp-tl" style={{ padding: '6px 8px' }}>{stepTimelineText(s)}</td>
                            <td style={{ padding: '4px 4px 4px 0', textAlign: 'right' }}>
                              <a
                                href={stepHref(s.id)}
                                className="stp-go"
                                aria-label={`Open step ${s.n} · ${s.title}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  portal.go(stepHref(s.id));
                                }}
                              >
                                <Ico n="arrow" size={14} sw={2} />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------- what is next */

function nextDrill(h: HomeData): DrillConfig {
  const open = h.filings.filter((f) => bucketOf(f, h.today) !== 'filed');
  const over = open.filter((f) => bucketOf(f, h.today) === 'overdue');
  const n15 = open.filter((f) => f.dueDate >= h.today && days(h.today, f.dueDate) <= 15);
  const n30 = open.filter((f) => days(h.today, f.dueDate) > 15 && days(h.today, f.dueDate) <= 30);
  const r = (f: HomeFiling) => ({ ...filingRow(f, h.today), href: portalHref('compliances') });
  return {
    title: 'What is next',
    tabs: [
      { label: 'All', rows: [...over, ...n15, ...n30].map(r) },
      { label: 'Overdue', rows: over.map(r) },
      { label: 'Next 15 days', rows: n15.map(r) },
      { label: '16–30 days', rows: n30.map(r) },
    ],
    link: { lead: 'These items live in Compliances', text: 'Open Compliances →', href: portalHref('compliances'), where: 'Compliances' },
  };
}

export function NextCard({ h }: { h: HomeData }) {
  const [tab, setTab] = useState(0);
  const open = h.filings.filter((f) => bucketOf(f, h.today) !== 'filed');
  const hero = open.find((f) => bucketOf(f, h.today) === 'overdue');
  const upcoming = open.filter((f) => f !== hero && f.dueDate >= h.today);
  const win = tab === 0 ? 15 : 30;
  const rows = upcoming.filter((f) => days(h.today, f.dueDate) <= win);
  const c15 = upcoming.filter((f) => days(h.today, f.dueDate) <= 15).length + (hero ? 1 : 0);
  const c30 = upcoming.filter((f) => days(h.today, f.dueDate) <= 30).length + (hero ? 1 : 0);
  const drill = (active: number) => h.portal.drill({ ...nextDrill(h), active });
  const ownerLabel = (f: HomeFiling) => (f.owner === 'client' ? h.company : f.owner === 'firm' ? 'SBC' : null);
  return (
    <div style={W}>
      <section className="card">
        <CardHead title="What is next" right={<Seg label="What is next window" value={tab} onChange={setTab} tabs={[{ label: '15 days', cnt: c15 }, { label: '30 days', cnt: c30 }]} />} />
        <div style={{ padding: '10px 16px 12px' }}>
          {hero
            ? (() => {
                const late = Math.max(1, days(hero.dueDate, h.today));
                const [day, mon] = dayMon(hero.dueDate);
                return (
                  <Tip
                    tip={`${hero.title} · overdue ${plural(late, 'day')}`}
                    onOpen={() => drill(1)}
                    style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 14px', padding: '12px 14px', borderRadius: 8, background: 'var(--over-light)', border: '1px solid oklch(57% 0.2 22 / 0.3)', marginBottom: 6 }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <span className="metric" style={{ fontSize: 30, lineHeight: 1, color: 'var(--over-text)' }}>{day}</span>
                      <div className="lbl" style={{ color: 'var(--over-text)' }}>{mon}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ display: 'flex', gap: '6px 8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="rt" style={{ fontSize: 14 }}>{filingName(hero)}</span>
                        <InfoPopover askAbout={filingName(hero)}>
                          {hero.owner === 'client'
                            ? `Waiting on ${h.company}${hero.needTitle ? ` · ${hero.needTitle}` : ''}${hero.needAskedBy ? ` · asked by ${hero.needAskedBy}` : ''}`
                            : 'With SBC'}
                        </InfoPopover>
                        <span className="chip" style={solid('over')}>Overdue {plural(late, 'day')}</span>
                      </div>
                    </div>
                    <a
                      className="btn btn-p"
                      href={portalHref('compliances')}
                      onClick={(e) => {
                        e.preventDefault();
                        h.portal.go('compliances');
                      }}
                      style={{ height: 30, padding: '0 10px', fontSize: 12, marginLeft: 'auto' }}
                    >
                      {hero.owner === 'client' ? 'Fill details' : 'Open'}
                    </a>
                  </Tip>
                );
              })()
            : null}
          {rows.map((f) => {
            const [day, mon] = dayMon(f.dueDate);
            const n = days(h.today, f.dueDate);
            const tone = n <= 7 ? 'due' : 'prog';
            const owner = ownerLabel(f);
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid var(--hair)' }}>
                <Tip
                  tip={`${f.title} · ${day} ${mon}`}
                  onOpen={() => drill(n <= 15 ? 2 : 3)}
                  style={{ position: 'relative', width: 44, height: 48, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: 'none', background: `var(--${tone})` }}
                >
                  <span className="metric" style={{ fontSize: 18, lineHeight: 1, color: '#fff' }}>{day}</span>
                  <span style={{ fontSize: 11, fontWeight: 800 }}>{mon}</span>
                </Tip>
                <div style={{ flex: 1 }}>
                  <div className="rt" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {f.title}
                    <InfoPopover askAbout={f.title}>
                      {[f.periodLabel, AREA_NAME[groupOf(f)], f.windowTo ? `SBC by ${dShort(f.windowTo)}` : null].filter(Boolean).join(' · ')}
                    </InfoPopover>
                  </div>
                </div>
                {owner ? (
                  <span className="chip" style={solid(f.owner === 'client' ? 'due' : 'prog')}>{owner}</span>
                ) : null}
                <span className="chip" style={{ width: 92, justifyContent: 'center', ...solid(tone) }}>{n === 0 ? 'Today' : `In ${plural(n, 'day')}`}</span>
              </div>
            );
          })}
          {!hero && rows.length === 0 ? (
            <BotSays size={40} action="">
              No filings due in the next {win} days.
            </BotSays>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------- compliance donut */

export function CompCard({ h, onOpen }: { h: HomeData; onOpen: (tab: number) => void }) {
  const total = h.filings.length;
  const b = h.buckets;
  const segs: [FilingBucket, number][] = BUCKETS.map((k) => [k, b[k]]);
  let acc = 0;
  const stops = segs
    .map(([k, n]) => {
      const a = acc;
      acc += total ? (n / total) * 100 : 0;
      return `var(--${k === 'filed' ? 'ok' : k === 'dueSoon' ? 'due' : k === 'overdue' ? 'over' : 'up'}) ${a.toFixed(1)}% ${acc.toFixed(1)}%`;
    })
    .join(',');
  const sliceAt = (e: MouseEvent<HTMLDivElement>): number | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    const dist = Math.hypot(x, y);
    if (dist < 49 || dist > 70 || !total) return null;
    const ang = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
    let c = 0;
    for (let i = 0; i < segs.length; i++) {
      c += (segs[i]![1] / total) * 360;
      if (ang <= c) return i;
    }
    return null;
  };
  const pctOf = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div style={W}>
      <section className="card">
        <CardHead
          title="Compliance status"
          info="Hover a slice for its count · click a slice, a legend row or the centre to see the list"
          right={<span className="chip" style={{ background: 'var(--up-light)', color: 'var(--up-text)', minWidth: 116, justifyContent: 'center' }}>{h.home?.filings.fyLabel ?? ''}</span>}
        />
        <div style={{ padding: '22px 16px 16px', display: 'flex', gap: 20, alignItems: 'center' }}>
          <div role="group" aria-label={segs.map(([k, n]) => `${BUCKET_LABEL[k]} ${n}`).join(', ')} style={{ position: 'relative', width: 140, height: 140, flex: 'none' }}>
            {/* slice hover and click are a mouse shortcut: the legend rows beside it open the same lists from the keyboard */}
            <div
              role="presentation"
              onMouseMove={(e) => {
                const i = sliceAt(e);
                h.portal.tipAt(e.clientX, e.clientY, i == null ? null : `${BUCKET_LABEL[segs[i]![0]]} · ${segs[i]![1]}`);
              }}
              onMouseLeave={() => h.portal.tipAt(0, 0, null)}
              onClick={(e) => {
                const i = sliceAt(e);
                if (i != null) {
                  h.portal.tipAt(0, 0, null);
                  onOpen(i + 1);
                }
              }}
              style={{ width: 140, height: 140, borderRadius: 99, background: total ? `conic-gradient(${stops})` : 'var(--raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <LinkButton
                title="Show all"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(0);
                }}
                style={{ width: 98, height: 98, borderRadius: 99, background: 'var(--panel)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--fg)' }}
              >
                <span className="metric" style={{ fontSize: 28, lineHeight: 1, color: 'var(--fg)' }}>{total}</span>
                <span className="cap">this FY</span>
              </LinkButton>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {segs.map(([k, n], i) => (
              <LinkButton
                key={k}
                data-tip={`${BUCKET_LABEL[k]} · ${n}`}
                onClick={() => onOpen(i + 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% + 16px)', padding: '6px 8px', margin: '0 -8px', borderRadius: 6, color: 'var(--fg)', fontWeight: 500, ...(k === 'dueSoon' ? { background: 'var(--raised)' } : {}) }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 2, background: `var(--${BUCKET_TONE[k] === 'ok' ? 'ok' : BUCKET_TONE[k]})` }} />
                <span className="rt" style={{ flex: 1, fontWeight: 500 }}>{BUCKET_LABEL[k]}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {n} ({pctOf(n)}%)
                </span>
              </LinkButton>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ company IDs */

export function IdsCard({ h, onReveal, onCoi }: { h: HomeData; onReveal: (f: 'pan' | 'tan') => void; onCoi?: () => void }) {
  const ids = h.home?.identifiers ?? {};
  const shown = { pan: useRevealedIdentifier('pan'), tan: useRevealedIdentifier('tan') };
  const rows: { k: string; v?: string; secret?: 'pan' | 'tan'; portal: [string, string] }[] = [
    { k: 'CIN', v: ids.cin, portal: ['https://www.mca.gov.in', 'MCA portal'] },
    { k: 'PAN', v: ids.panMasked, secret: 'pan', portal: ['https://www.incometax.gov.in', 'Income-tax portal'] },
    { k: 'TAN', v: ids.tanMasked, secret: 'tan', portal: ['https://www.tin-nsdl.com', 'TIN-NSDL portal'] },
    { k: 'GSTIN', v: ids.gstin, portal: ['https://www.gst.gov.in', 'GST portal'] },
  ];
  const btn: CSSProperties = { border: 0, borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  return (
    <div style={W}>
      <section className="card">
        <CardHead
          title="Company IDs"
          info="PAN and TAN need your password to show"
          right={
            onCoi ? (
              <LinkButton onClick={() => onCoi()} style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                COI <Ico n="arrow" size={12} sw={2} />
              </LinkButton>
            ) : null
          }
        />
        <div style={{ padding: '4px 16px 10px' }}>
          {rows.map((r) => (
            <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '62px minmax(0,1fr) auto', alignItems: 'center', gap: '6px 10px', padding: '9px 0', borderTop: '1px solid var(--hair)' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="lbl">{r.k}</span>
                {r.secret && r.v ? (
                  <span className="chip" style={{ padding: '0 5px', fontSize: 11, background: 'var(--navy)', color: 'var(--gold)' }}>Private</span>
                ) : null}
              </span>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, ...(r.secret ? { letterSpacing: '.06em' } : { overflowWrap: 'anywhere' }), ...(r.v ? {} : { color: 'var(--subtle)' }), ...(r.secret && shown[r.secret] ? { color: 'var(--ok-text)' } : {}) }}>
                {(r.secret && shown[r.secret]) || r.v || '—'}
              </span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {r.v && r.secret ? (
                  <button type="button" aria-label={`Show ${r.k}`} onClick={() => onReveal(r.secret!)} style={{ ...btn, background: 'var(--navy)', color: '#fff' }}>
                    <Ico n="eye" />
                  </button>
                ) : r.v ? (
                  <button
                    type="button"
                    aria-label={`Copy ${r.k}`}
                    onClick={() => void copyText(r.v!).then((ok) => h.portal.toast(ok ? `Copied · ${r.v}` : 'Copy blocked by this browser'))}
                    style={{ ...btn, background: 'var(--primary-light)', color: 'var(--primary)' }}
                  >
                    <Ico n="copy" />
                  </button>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------ compliance by area */

function areaDrill(h: HomeData, area: (typeof AREA_ORDER)[number], active: number): DrillConfig {
  const list = h.filings.filter((f) => groupOf(f) === area);
  const by = (b: FilingBucket) => list.filter((f) => bucketOf(f, h.today) === b).map((f) => filingRow(f, h.today));
  return {
    title: `${AREA_NAME[area]} · filings`,
    active,
    tabs: [
      { label: 'All', rows: list.map((f) => filingRow(f, h.today)) },
      { label: 'Filed', rows: by('filed') },
      { label: 'Due soon', rows: by('dueSoon') },
      { label: 'Overdue', rows: by('overdue') },
      { label: 'Upcoming', rows: by('upcoming') },
    ],
    link: { lead: 'These items live in Filings', text: 'Open Filings →', href: portalHref('filings'), where: 'Filings' },
  };
}

const AREA_TAB: Record<string, string> = { MCA: 'MCA', GST: 'GST', 'Income tax': 'Income tax', Payroll: 'Payroll', FEMA: 'FEMA', Other: 'Other' };

export function AreaCard({ h }: { h: HomeData }) {
  const [tab, setTab] = useState(0);
  const areas = AREA_ORDER.filter((a) => a !== 'Other' || h.filings.some((f) => groupOf(f) === 'Other'));
  const stat = (a: (typeof AREA_ORDER)[number]) => {
    const list = h.filings.filter((f) => groupOf(f) === a);
    const c = { filed: 0, dueSoon: 0, overdue: 0, upcoming: 0 };
    for (const f of list) c[bucketOf(f, h.today)] += 1;
    const status: [string, 'ok' | 'due' | 'over' | 'up'] = c.overdue
      ? ['Overdue', 'over']
      : c.dueSoon
        ? ['Due soon', 'due']
        : c.filed && list.length
          ? ['Compliant', 'ok']
          : ['Upcoming', 'up'];
    return { list, c, total: list.length, status };
  };
  const all = h.buckets;
  const one = tab > 0 ? areas[tab - 1]! : null;
  const asOf = `${h.home?.filings.fyLabel ?? ''} · as of ${dLong(h.today)}`;
  return (
    <div style={W}>
      <section className="card">
        <CardHead title="Compliance by area" right={<span className="chip" style={{ background: 'var(--up-light)', color: 'var(--up-text)', minWidth: 116, justifyContent: 'center' }}>{asOf}</span>} />
        <div style={{ padding: '12px 16px 14px' }}>
          <Seg full wrap label="Compliance area" value={tab} onChange={setTab} tabs={[{ label: 'All', cnt: h.filings.length }, ...areas.map((a) => ({ label: AREA_TAB[a]!, cnt: stat(a).total }))]} />
          {one === null ? (
            <div className="vh-x" style={{ '--tmin': '600px' } as CSSProperties}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Area</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Filed</th>
                    <th style={{ textAlign: 'right' }}>Due soon</th>
                    <th style={{ textAlign: 'right' }}>Overdue</th>
                    <th style={{ width: '26%' }}>Mix</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map((a) => {
                    const s = stat(a);
                    return (
                      <tr key={a}>
                        <td className="rt" style={{ padding: 8 }}>{AREA_NAME[a]}</td>
                        <td className="mono" style={{ padding: 8, textAlign: 'right' }}>{s.total}</td>
                        <td className="mono" style={{ padding: 8, textAlign: 'right', color: 'var(--ok-text)' }}>{s.c.filed}</td>
                        <td className="mono" style={{ padding: 8, textAlign: 'right', color: 'var(--due-text)' }}>{s.c.dueSoon}</td>
                        <td className="mono" style={{ padding: 8, textAlign: 'right', color: 'var(--over-text)' }}>{s.c.overdue}</td>
                        <td style={{ padding: 8 }}>
                          <div className="stack" style={{ height: 10 }}>
                            {BUCKETS.map((b, bi) =>
                              s.c[b] > 0 ? (
                                <Tip
                                  key={b}
                                  tip={`${AREA_TAB[a]} · ${BUCKET_LABEL[b]} · ${s.c[b]}`}
                                  onOpen={() => h.portal.drill(areaDrill(h, a, bi + 1))}
                                  style={{ position: 'relative', width: `${(s.c[b] * 100) / s.total}%`, background: `var(--${BUCKET_TONE[b]})` }}
                                />
                              ) : null,
                            )}
                          </div>
                        </td>
                        <td style={{ padding: 8 }}>
                          <span className="chip" style={solid(s.status[1])}>{s.status[0]}</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="rt" style={{ padding: 8, borderTop: '1.5px solid var(--border)', fontWeight: 800 }}>Total</td>
                    {[h.filings.length, all.filed, all.dueSoon, all.overdue].map((v, i) => (
                      <td key={i} className="mono" style={{ padding: 8, textAlign: 'right', fontWeight: 700, borderTop: '1.5px solid var(--border)' }}>
                        {v}
                      </td>
                    ))}
                    <td style={{ borderTop: '1.5px solid var(--border)' }} />
                    <td style={{ borderTop: '1.5px solid var(--border)' }} />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            (() => {
              const s = stat(one);
              const order: Record<FilingBucket, number> = { overdue: 0, dueSoon: 1, upcoming: 2, filed: 3 };
              const fil = [...s.list].sort((x, y) => order[bucketOf(x, h.today)] - order[bucketOf(y, h.today)] || x.dueDate.localeCompare(y.dueDate)).slice(0, 8);
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '12px 0 4px' }}>
                    <span className="metric" style={{ fontSize: 22 }}>{AREA_NAME[one]}</span>
                    <span className="cap">
                      {s.total} filings this FY · {s.c.filed} filed · {s.c.dueSoon} due soon · {s.c.overdue} overdue
                    </span>
                  </div>
                  <div className="vh-x" style={{ '--tmin': '600px' } as CSSProperties}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th>Filing</th>
                          <th>Period</th>
                          <th style={{ textAlign: 'right' }}>Due / filed</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fil.map((f) => {
                          const b = bucketOf(f, h.today);
                          return (
                            <tr key={f.id}>
                              <td className="rt" style={{ padding: '7px 8px' }}>{f.title}</td>
                              <td className="cap" style={{ padding: '7px 8px' }}>{f.periodLabel ?? f.fyLabel ?? '—'}</td>
                              <td className="mono" style={{ padding: '7px 8px', textAlign: 'right', fontSize: 12 }}>{b === 'filed' && f.filedOn ? `Filed ${dLong(f.filedOn)}` : dLong(f.dueDate)}</td>
                              <td style={{ padding: '7px 8px' }}>
                                <span className="chip" style={solid(BUCKET_TONE[b])}>{BUCKET_LABEL[b]}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="cap" style={{ marginTop: 6 }}>
                    {fil.length < s.total ? `Showing ${fil.length} of ${s.total} · full list in Filings` : `Showing all ${s.total}`}
                  </div>
                </>
              );
            })()
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------- registrations */

export function RegCard({ h, onProof }: { h: HomeData; onProof: (r: RegRow) => void }) {
  const [tab, setTab] = useState(0);
  const rows = h.regs.filter((r) => tab === 0 || r.cat === REG_CATS[tab - 1]);
  return (
    <div style={W}>
      <section className="card">
        <CardHead title="Registrations" />
        <div style={{ padding: '12px 16px 14px' }}>
          <Seg full wrap label="Registration category" value={tab} onChange={setTab} tabs={[{ label: 'All', cnt: h.regs.length }, ...REG_CATS.map((c) => ({ label: c, cnt: h.regs.filter((r) => r.cat === c).length }))]} />
          <div className="vh-x" style={{ '--tmin': '720px' } as CSSProperties}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Category</th>
                  <th>Authority</th>
                  <th>Number</th>
                  <th style={{ textAlign: 'right' }}>Date</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.step.id}>
                    <td className="rt" style={{ padding: '7px 8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <a
                          href={stepHref(r.step.id)}
                          onClick={(e) => {
                            e.preventDefault();
                            h.portal.go(stepHref(r.step.id));
                          }}
                          style={{ color: 'inherit', fontWeight: 600 }}
                        >
                          {r.name}
                        </a>
                      </span>
                    </td>
                    <td style={{ padding: '7px 8px' }}>{r.cat}</td>
                    <td className="cap" style={{ padding: '7px 8px' }}>{r.authority}</td>
                    <td className="mono" style={{ padding: '7px 8px', fontSize: 11.5, fontWeight: 600 }}>{r.number ?? '-'}</td>
                    <td className="mono" style={{ padding: '7px 8px', textAlign: 'right', fontSize: 12 }}>{r.dateLabel}</td>
                    <td style={{ padding: '7px 8px' }}>
                      <span className="chip" style={solid(r.tone)}>{r.status}</span>
                    </td>
                    <td style={{ padding: '7px 8px' }}>
                      {r.status === 'Registered' ? (
                        r.certPath ? (
                          <LinkButton aria-label="Download certificate" title="Certificate" className="w-full" onClick={() => onProof(r)} style={{ color: 'var(--primary)', display: 'flex' }}>
                            <Ico n="download" size={15} />
                          </LinkButton>
                        ) : (
                          <span className="chip" title="Filed, proof not uploaded yet" style={{ background: 'var(--due-light)', color: 'var(--due-text)', whiteSpace: 'nowrap' }}>
                            Proof pending
                          </span>
                        )
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- post-inc */

export function PostIncCard({ h }: { h: HomeData }) {
  const { open, done, dayN } = h.post;
  const drill = (a: number) => h.portal.drill(postIncDrill(open, done, a));
  return (
    <div style={W}>
      <section className="card">
        <CardHead
          title="Post-incorporation setup"
          right={dayN != null ? <span className="chip" style={{ background: 'var(--up-light)', color: 'var(--up-text)', minWidth: 116, justifyContent: 'center' }}>Day {dayN} since COI</span> : null}
        />
        <div style={{ padding: '8px 16px 4px' }}>
          <div className="lbl" style={{ color: 'var(--navy-ink,var(--navy))', margin: '4px 0 2px' }}>Open · statutory window used</div>
          {open.map((p) => (
            <div key={p.step.id} style={{ padding: '10px 0', borderTop: '1px solid var(--hair)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="rt" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {p.step.title}
                  <InfoPopover askAbout={p.step.title}>{p.info}</InfoPopover>
                </span>
                <span className="chip" style={ownerChipStyle(p.owner)}>{p.owner === 'client' ? h.company : 'SBC'}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, width: 'auto', minWidth: 80, textAlign: 'right', whiteSpace: 'nowrap' }}>{p.dueDate ? dLong(p.dueDate) : '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <Tip
                  tip={`${p.step.title}${p.overDays ? ` · overdue ${p.overDays} day${p.overDays === 1 ? '' : 's'}` : p.limitDays && p.day != null ? ` · day ${p.day} of ${p.limitDays}` : ''}${p.dueDate ? ` · due ${dShort(p.dueDate)}` : ''}`}
                  label={p.step.title}
                  onOpen={() => drill(1)}
                  style={{ flex: 1, position: 'relative', height: 10, borderRadius: 3, background: 'var(--raised)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
                >
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${p.usedPct.toFixed(1)}%`, borderRadius: 3, background: p.overDays ? 'var(--over)' : p.owner === 'client' ? 'var(--due)' : 'var(--prog)' }} />
                </Tip>
                <span className="mono cap" style={{ width: 'auto', minWidth: 80, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, ...(p.overDays ? { color: 'var(--over-text)' } : null) }}>
                  {p.overDays ? `overdue ${p.overDays} day${p.overDays === 1 ? '' : 's'}` : p.limitDays && p.day != null ? `day ${p.day} of ${p.limitDays}` : 'no time limit'}
                </span>
              </div>
            </div>
          ))}
          {open.length === 0 ? (
            <div style={{ padding: '10px 0', borderTop: '1px solid var(--hair)' }}>
              <BotSays size={40} action="">
                Every post-incorporation step is done.
              </BotSays>
            </div>
          ) : null}
        </div>
        <div style={{ padding: '4px 16px 14px' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Ico n="check" size={16} style={{ color: 'var(--ok-text)', marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div className="rt" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tip tip={`Completed · ${plural(done.length, 'item')}`} onOpen={() => drill(2)} style={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                  {done.length} completed
                </Tip>
                {done.length ? <InfoPopover askAbout="post-incorporation setup">{done.map((s) => `${s.title} · ${dShort(s.doneOn)}`).join(' · ')}</InfoPopover> : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
