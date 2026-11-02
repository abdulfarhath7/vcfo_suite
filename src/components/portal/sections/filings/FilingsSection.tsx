'use client';

/**
 * Filings (prototype body.txt FILINGS + a4_cal.js renderFilings): Monthly /
 * Quarterly / Annual periods with ‹ › navigation across financial years, a
 * status donut and the law rings, law + status filters, the filings table
 * (date tile, law, filing + period, frequency, filed on, status, proof) and
 * the Export menu (real CSV export of the view or the year, and an .ics of
 * the year's open deadlines). Rows come from /api/client/compliances.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fyLabelOf, statusOf, type PortalFiling } from '@/lib/client-portal/compliances';
import { fyRange, inPeriod, periodAt, periodFile, periodLabel, periodRange, periodShort, stepPeriod, type FPeriod, type Gran } from '@/lib/client-portal/filing-track';
import { useNavBadge, usePortal } from '../../runtime';
import { useFilings } from '../../data';
import { fmtY, fyOf, todayIso } from '../../dates';
import { PopHead } from '../../overlays';
import { Btn, DateTile, Icon, LAWS, LawChip, lawVar, Seg, SecError, SecHead, SecLoading, StatusPill, type FilingSt, type LawKey } from '../../ui';
import { download, ProofCard, useFilingActions } from './actions';
import { Donut, LawRings, lawShort, statusSegs } from './charts';
import '../../css/95-filings.css';

type Law = LawKey | 'all';

export function FilingsSection() {
  const { shell, openPop } = usePortal();
  const { openFiling } = useFilingActions();
  const today = todayIso();
  const curFy = fyOf(today).start;
  const [per, setPer] = useState<FPeriod>(() => periodAt('month', today));
  const [law, setLaw] = useState<Law>('all');
  const [status, setStatus] = useState<FilingSt | null>(null);

  const q = useFilings(per.fy);
  const cur = useFilings();
  const overdue = (cur.data?.rows ?? []).filter((r) => statusOf(r, today) === 'over').length;
  useNavBadge('filings', overdue || undefined);

  const all = useMemo(() => q.data?.rows ?? [], [q.data]);
  const inP = useMemo(() => all.filter((r) => inPeriod(per, r.dueDate)), [all, per]);

  // SBC-calendar rows start after incorporation: open on the first month that has one, once
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !q.data?.fromCalendar || !all.length || inP.length) return;
    jumped.current = true;
    const first = [...all].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]!;
    setPer(periodAt(per.gran, first.dueDate));
  }, [q.data?.fromCalendar, all, inP.length, per.gran]);
  const lawScoped = inP.filter((r) => law === 'all' || r.area === law);
  const rows = lawScoped
    .filter((r) => !status || statusOf(r, today) === status)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));

  const span = fyRange(cur.data?.rows ?? [], curFy);
  const canPrev = stepPeriod(per, -1).fy >= span.lo;
  const canNext = stepPeriod(per, 1).fy <= span.hi;
  const setGran = (g: Gran) => setPer(g === per.gran ? per : g === 'year' ? { gran: 'year', fy: per.fy, idx: 0 } : per.fy === curFy ? periodAt(g, today) : { gran: g, fy: per.fy, idx: 0 });

  const head = (
    <SecHead title="Filings">
      <Seg<Gran>
        ariaLabel="Period"
        value={per.gran}
        onChange={setGran}
        options={[
          { value: 'month', label: 'Monthly' },
          { value: 'quarter', label: 'Quarterly' },
          { value: 'year', label: 'Annual' },
        ]}
      />
      <Btn
        ico="dl"
        disabled={!q.isSuccess}
        onClick={(e) => openPop(e.currentTarget, <ExportMenu per={per} law={law} status={status} count={rows.length} />, { kind: 'export' })}
      >
        Export
      </Btn>
    </SecHead>
  );

  if (q.isError)
    return (
      <>
        {head}
        <SecError message="Your filings could not load." onRetry={() => void q.refetch()} />
      </>
    );
  if (q.isPending)
    return (
      <>
        {head}
        <SecLoading label="Loading your filings…" />
      </>
    );
  if (!all.length && per.fy === curFy && shell && !shell.incorporated)
    return (
      <>
        <SecHead title="Filings" />
        <div className="glass panel">
          <p className="sec-empty">Your filings start after incorporation. Nothing is due yet.</p>
        </div>
      </>
    );

  return (
    <>
      {head}
      {q.data?.fromCalendar ? (
        <div className="banner info" style={{ margin: '0 0 14px' }}>
          <Icon name="cal" />
          <div>
            <b>SBC’s compliance calendar, until your register starts</b>
            <span>
              {shell?.companyShort || 'Your company'} has no filings on its register yet. The rows below are the deadlines that will apply once it is incorporated and registered. They are marked SBC calendar and have no proof or reminder until SBC adds them to your register.
            </span>
          </div>
        </div>
      ) : null}
      <div className="fsum">
        <section className="glass panel">
          <div className="ph" style={{ marginBottom: 10 }}>
            <h3>Status · {periodShort(per)}</h3>
          </div>
          <Donut<FilingSt> segs={statusSegs(lawScoped, today)} sel={status} onPick={setStatus} centerTop="FILINGS" />
        </section>
        <section className="glass panel">
          <div className="ph" style={{ marginBottom: 6 }}>
            <h3>By area of law</h3>
          </div>
          <LawRings rows={inP} today={today} sel={law} onPick={setLaw} />
        </section>
      </div>
      <div className="ftool">
        <Seg<Law>
          ariaLabel="Area of law"
          value={law}
          onChange={setLaw}
          options={[
            { value: 'all', label: 'All areas', n: inP.length },
            ...LAWS.map((l) => ({ value: l.k as Law, label: lawShort(l.k), dot: lawVar(l.k), n: inP.filter((r) => r.area === l.k).length })),
          ]}
        />
        <span className="sp" />
        <Seg<FilingSt | 'any'>
          ariaLabel="Status"
          value={status ?? 'any'}
          onChange={(v) => setStatus(v === 'any' ? null : v)}
          options={[
            { value: 'any', label: 'Any status', n: lawScoped.length },
            ...(['over', 'due', 'up', 'ok'] as FilingSt[]).map((k) => ({
              value: k,
              label: { over: 'Overdue', due: 'Due soon', up: 'Upcoming', ok: 'Filed' }[k],
              n: lawScoped.filter((r) => statusOf(r, today) === k).length,
            })),
          ]}
        />
      </div>
      <section className="glass" style={{ overflow: 'hidden' }}>
        <div className="pnav">
          <button type="button" className="ib" aria-label="Previous period" disabled={!canPrev} onClick={() => setPer(stepPeriod(per, -1))}>
            <Icon name="chev" style={{ transform: 'rotate(180deg)' }} />
          </button>
          <h3>{periodLabel(per)}</h3>
          <button type="button" className="ib" aria-label="Next period" disabled={!canNext} onClick={() => setPer(stepPeriod(per, 1))}>
            <Icon name="chev" />
          </button>
          <span className="small">
            {rows.length} filing{rows.length === 1 ? '' : 's'}
          </span>
          <span className="sp" />
          {law !== 'all' || status ? (
            <Btn
              cls="sm"
              onClick={() => {
                setLaw('all');
                setStatus(null);
              }}
            >
              Clear filters
            </Btn>
          ) : null}
        </div>
        <div className="ftb">
          <table className="ft">
            <thead>
              <tr>
                <th>Due</th>
                <th>Area</th>
                <th>Filing</th>
                <th>Frequency</th>
                <th>Filed on</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Proof</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((r) => <Row key={r.id} r={r} today={today} onOpen={(el) => openFiling(r, el)} onProof={(el) => openPop(el, <ProofCard f={r} />, { kind: 'proof' })} />)
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)' }}>
                    {inP.length ? 'No filings match. Clear the filters or pick another period.' : `Nothing is due in ${periodLabel(per).replace(/^Full year · /, '')}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Row({ r, today, onOpen, onProof }: { r: PortalFiling; today: string; onOpen: (el: Element) => void; onProof: (el: Element) => void }) {
  const st = statusOf(r, today);
  return (
    <tr
      className="r"
      tabIndex={0}
      onClick={(e) => onOpen(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(e.currentTarget);
      }}
    >
      <td>
        <DateTile iso={r.dueDate} st={st === 'over' ? 'over' : st === 'due' ? 'due' : null} />
      </td>
      <td>
        <LawChip law={r.area} />
      </td>
      <td>
        <div className="fn">{r.name}</div>
        <div className="fp">{r.period}</div>
      </td>
      <td>{r.freqLabel}</td>
      <td className="num" style={{ fontSize: 13.5 }}>
        {r.filedOn ? fmtY(r.filedOn) : '—'}
      </td>
      <td>{r.fromCalendar ? <span className="pill mut" title="From SBC’s compliance calendar · applies once you are incorporated">SBC calendar</span> : <StatusPill st={st} />}</td>
      <td style={{ textAlign: 'right' }}>
        {st === 'ok' ? (
          <button
            type="button"
            className="btn sm"
            onClick={(e) => {
              e.stopPropagation();
              onProof(e.currentTarget);
            }}
          >
            <Icon name="doc" />
            {r.proofCount > 1 ? `Proof · ${r.proofCount}` : 'Proof'}
          </button>
        ) : (
          <span className="small">—</span>
        )}
      </td>
    </tr>
  );
}

/* ---------------------------------------------------------------- export */

function ExportMenu({ per, law, status, count }: { per: FPeriod; law: Law; status: FilingSt | null; count: number }) {
  const { closePop, toast } = usePortal();
  const { from, to } = periodRange(per);
  const fy = fyLabelOf(per.fy);
  const view = new URLSearchParams({ fy: String(per.fy), area: law, status: status ?? 'all', from, to });
  const run = (href: string, msg: string) => {
    closePop();
    download(href);
    toast(`Download started · ${msg}`);
  };
  return (
    <div>
      <PopHead title="Export" sub={`${count} filing${count === 1 ? '' : 's'} · ${periodLabel(per)}`} />
      <div className="menu" style={{ marginTop: 8 }}>
        <button type="button" onClick={() => run(`/api/client/compliances/export?${view.toString()}`, `filings ${periodFile(per)} (CSV)`)}>
          <Icon name="grid" />
          This view, as a spreadsheet
          <small>.csv</small>
        </button>
        {per.gran !== 'year' || law !== 'all' || status ? (
          <button type="button" onClick={() => run(`/api/client/compliances/export?fy=${per.fy}`, `${fy} filings (CSV)`)}>
            <Icon name="grid" />
            All of {fy}, as a spreadsheet
            <small>.csv</small>
          </button>
        ) : null}
        <button type="button" onClick={() => run(`/api/client/compliances/ics?fy=${per.fy}`, `${fy} deadlines (.ics)`)}>
          <Icon name="cal" />
          Open deadlines of {fy} for my calendar
          <small>.ics</small>
        </button>
      </div>
    </div>
  );
}
