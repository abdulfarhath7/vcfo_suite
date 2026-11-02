'use client';

/**
 * FILINGS REGISTER — /app/manager/compliances/filings (and the lead seat's
 * /app/intern/compliances/filings). Prototype a59s `mxRenderers.filings`: a
 * status ribbon and area cards that filter, then the period grouped by due
 * date, one row per client and filing, with proof, window and Mark filed.
 *
 * Live functions kept (origin/main FilingsView): the FY stepper (`?fy=`, next
 * stops two years ahead), the company picker (`?company=`), Monthly /
 * Quarterly / Annual (`?cadence=`), the status filter (`?status=` with the
 * live values), the month stepper (`?period=`) and Full year sheet
 * (`?view=year`), the quarterly sheet with due and filed dates, the annual
 * list, the glance counts and Next filing (→ calendar `?date=`), the window
 * control and the proof-and-details editor (managers, admins, super admins
 * only; leads read the window), Open calendar, the pre-incorporation notice
 * and the portfolio note. Added from the prototype on real data: area
 * filter (`?area=`), Mark filed with Undo, Remind me, Export CSV and .ics.
 */
import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AREA_LABEL, filingsIcs, fyStartOfMonth, MON, monthLabel as monthLong } from '@/lib/client-portal/compliances';
import { financialYearLabel, financialYearMonths, financialYearQuarters, parseFyParam, parseMonthParam, quarterForMonthKey } from '@/lib/filings';
import { SecError } from '@/components/portal/ui';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Btn, ClientAv, Empty, Icon, Seg } from '../../ui';
import { daysBetween, dDay, dShort, late, plural } from '../today/model';
import { useTodayIso } from '../today/useToday';
import {
  C_COLOR,
  C_LABEL,
  C_ORDER,
  C_SHORT,
  C_TIP,
  CADENCE_LABEL,
  areaStats,
  asPortal,
  byDay,
  countSt,
  filterRows,
  isCadence,
  nextDeadline,
  parseArea,
  parseStatus,
  periodMatrix,
  quarterOf,
  registerCsv,
  statusParam,
  whenText,
  winShort,
  worstOf,
  type Cadence,
  type CRow,
  type MxRow,
  type BookClient,
  type StatusFilter,
  STATUS_FILTER_LABEL,
} from './model';
import { useBook, useComplianceBadges } from './data';
import { ComplianceBanners, CompanySelect, FilingPop, LawTag, MonthPick, ProofEditor, ReminderBtn, StPill, WindowPop, downloadText, useMarkFiled } from './shared';

export function FilingsPage() {
  return (
    <Suspense fallback={<div className="glass panel mx-p"><div className="sec-load">Loading the register…</div></div>}>
      <Filings />
    </Suspense>
  );
}

const RIBBON: Array<{ k: Exclude<StatusFilter, 'all'>; label: string; color: string }> = [
  { k: 'f', label: 'Filed', color: 'var(--mx-ok)' },
  { k: 'd', label: 'Due this week', color: C_COLOR.d },
  { k: 'o', label: 'Overdue', color: C_COLOR.o },
  { k: 'u', label: 'Upcoming', color: C_COLOR.u },
  { k: 'c', label: 'SBC calendar', color: C_COLOR.c },
];

function Filings() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { base, go, openPop } = useConsole();
  const today = useTodayIso();
  useComplianceBadges();

  const currentFy = fyStartOfMonth(today.slice(0, 7));
  const cadenceParam = params.get('cadence');
  const cadence: Cadence = isCadence(cadenceParam) ? cadenceParam : 'monthly';
  const period = parseMonthParam(params.get('period'));
  const fy = parseFyParam(params.get('fy')) ?? (period ? fyStartOfMonth(period) : currentFy);
  const monthKey = period ?? today.slice(0, 7);
  const fullYear = params.get('view') === 'year';
  const status = parseStatus(params.get('status'));
  const area = parseArea(params.get('area'));

  const data = useBook(fy);
  const { book, mayWrite } = data;
  const sole = book.clients.length === 1 ? book.clients[0] : undefined;
  const rawCompany = params.get('company');
  const company = sole ? sole.id : rawCompany && book.byId[rawCompany]?.inScope ? rawCompany : 'all';
  const companyName = company !== 'all' ? book.byId[company]?.short : undefined;
  useCrumbs(companyName ? ['Filings register', companyName] : ['Filings register']);

  useEffect(() => {
    if (data.leadHasNothing) router.replace(`${base}/today`);
  }, [data.leadHasNothing, router, base]);

  const setParams = (next: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) s.delete(k);
      else s.set(k, v);
    }
    router.replace(`${pathname}?${s.toString()}`, { scroll: false });
  };

  /* ---------- the rows */
  const base0 = useMemo(() => filterRows(book.rows, { company }), [book.rows, company]);
  const counts = useMemo(() => countSt(base0), [base0]);
  const areas = useMemo(() => areaStats(base0), [base0]);
  const next = nextDeadline(base0, today);
  const listed = useMemo(() => filterRows(base0, { area, status, cadence }), [base0, area, status, cadence]);
  const months = useMemo(() => financialYearMonths(fy), [fy]);
  const monthIndex = months.findIndex((m) => m.key === monthKey);
  const sheet = cadence === 'monthly' && !fullYear ? listed.filter((r) => r.due.slice(0, 7) === monthKey) : listed;
  const perClient = company === 'all';
  const matrix = useMemo<{ cols: Array<{ key: string; label: string; sub?: string; now: boolean }>; rows: MxRow[] } | null>(() => {
    if (cadence === 'quarterly') {
      const qs = financialYearQuarters(fy);
      const cur = quarterForMonthKey(today.slice(0, 7), fy)?.key;
      return { cols: qs.map((q) => ({ key: q.key, label: q.label, sub: q.rangeLabel, now: q.key === cur })), rows: periodMatrix(listed, qs.map((q) => q.key), quarterOf(fy), perClient) };
    }
    if (cadence === 'monthly' && fullYear)
      return { cols: months.map((m) => ({ key: m.key, label: m.shortLabel, now: m.key === today.slice(0, 7) })), rows: periodMatrix(listed, months.map((m) => m.key), (r) => r.due.slice(0, 7), perClient) };
    return null;
  }, [cadence, fullYear, fy, months, listed, perClient, today]);

  /* ---------- search: the FY's register filings */
  const palette = useMemo<PaletteItem[]>(
    () =>
      book.rows
        .filter((r) => !r.cal)
        .slice(0, 300)
        .map((r) => ({
          id: `filing:${r.id}`,
          label: `${r.name}${r.period ? ` · ${r.period}` : ''} · ${book.byId[r.clientId]?.short ?? r.clientName}`,
          kind: `Filing · ${dShort(r.due, today)} · ${C_LABEL[r.st]}`,
          sw: C_COLOR[r.st],
          go: () => go(`${base}/compliances/filings?fy=${book.fy}&cadence=${r.cadence ?? 'annual'}${r.cadence === 'monthly' ? `&period=${r.due.slice(0, 7)}` : ''}&company=${r.clientId}`),
        })),
    [book.rows, book.byId, book.fy, today, go, base],
  );
  useConsolePalette('compliance-filings', palette);

  const companyQ = company !== 'all' && !sole ? `company=${company}` : '';
  const openRow = (r: CRow, el: Element | null) => openPop(el, <FilingPop id={r.id} fy={fy} />, { cls: 'mx-wide' });
  const fileStem = `filings-${financialYearLabel(fy).replace(/\s+/g, '-')}-${cadence}${cadence === 'monthly' && !fullYear ? `-${monthKey}` : ''}`;
  const exportCsv = () => downloadText(`${fileStem}.csv`, '﻿' + registerCsv(sheet), 'text/csv;charset=utf-8');
  const unfiled = sheet.filter((r) => !r.cal && !r.filedOn);
  const exportIcs = () => downloadText(`${fileStem}.ics`, filingsIcs(unfiled.map(asPortal)), 'text/calendar;charset=utf-8');

  const title =
    cadence === 'monthly' ? (fullYear ? `Monthly · ${book.fyLabel}` : monthLong(monthKey)) : `${CADENCE_LABEL[cadence]} · ${book.fyLabel}`;
  const filtersOn = status !== 'all' || area !== 'all';
  const filterWords = [status !== 'all' ? STATUS_FILTER_LABEL[status] : '', area !== 'all' ? AREA_LABEL[area] : ''].filter(Boolean).join(' · ');

  return (
    <>
      <div className="sec-h">
        <h2>Filings register</h2>
        <div className="mx-mnav">
          <button type="button" className="ib sm" aria-label="Previous financial year" onClick={() => setParams({ fy: String(fy - 1), period: null })}>
            <Icon name="back" />
          </button>
          <span className="sec-count">{book.fyLabel}</span>
          <button type="button" className="ib sm" aria-label="Next financial year" disabled={fy >= currentFy + 2} onClick={() => setParams({ fy: String(fy + 1), period: null })}>
            <Icon name="chev" />
          </button>
        </div>
        <span className="sp" />
        {book.clients.length > 1 ? <CompanySelect clients={book.clients} value={company} onChange={(v) => setParams({ company: v === 'all' ? null : v })} /> : null}
        <Seg<Cadence>
          className="sm"
          ariaLabel="Filing cadence"
          value={cadence}
          onChange={(v) => setParams({ cadence: v })}
          options={(['monthly', 'quarterly', 'annual'] as Cadence[]).map((c) => ({ value: c, label: CADENCE_LABEL[c] }))}
        />
        <Btn cls="sm" ico="dl" disabled={!sheet.length} title="Download the rows on screen as a CSV file" onClick={exportCsv}>
          Export
        </Btn>
        <Btn cls="sm" ico="cal" disabled={!unfiled.length} title="Download the unfiled filings on screen as an .ics file for a calendar app" onClick={exportIcs}>
          .ics
        </Btn>
        <Btn cls="sm" ico="cal" onClick={() => go(`${base}/compliances/calendar${companyQ ? `?${companyQ}` : ''}`)}>
          Calendar
        </Btn>
      </div>

      {!data.loading ? <ComplianceBanners book={book} company={company} /> : null}

      <section className="glass mx-fribbon" aria-label={`${book.fyLabel} at a glance, every cadence`}>
        <div className="mx-frbar">
          {RIBBON.filter((s) => s.k !== 'c' || counts.c).map((s) => {
            const n = s.k === 'f' ? counts.f + counts.l : counts[s.k];
            return (
              <button
                key={s.k}
                type="button"
                className={status === s.k ? 'on' : ''}
                aria-pressed={status === s.k}
                style={{ flex: n || 0.3, ['--bc' as string]: s.color }}
                title={`${s.label} · ${n} in ${book.fyLabel} · ${status === s.k ? 'click to show every status' : 'click to show only these'}`}
                onClick={() => setParams({ status: status === s.k ? null : statusParam(s.k) })}
              >
                <b>{data.loading ? '–' : n}</b>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mx-frareas">
          {areas.map((a) => (
            <button
              key={a.area}
              type="button"
              className={'mx-fra' + (area === a.area ? ' on' : '')}
              aria-pressed={area === a.area}
              title={`${a.label} · ${area === a.area ? 'click to show every area' : 'click to show only these'}`}
              onClick={() => setParams({ area: area === a.area ? null : a.area })}
            >
              <LawTag area={a.area} tag={a.area} />
              <span className="mx-dt">
                <b>{a.label}</b>
                <span>{a.register ? `${a.filed} of ${a.register} filed` : a.lines ? `${a.lines} on SBC calendar` : 'Nothing this year'}</span>
              </span>
              <span className="mx-frm">
                <i style={{ width: `${a.register ? (a.filed / a.register) * 100 : 0}%` }} />
              </span>
            </button>
          ))}
          {next ? (
            <button
              type="button"
              className="mx-fra cf-next"
              title="Open the calendar on this day"
              onClick={() => go(`${base}/compliances/calendar?date=${next.due}${companyQ ? `&${companyQ}` : ''}`)}
            >
              <Icon name="clock" size={16} />
              <span className="mx-dt">
                <b className="cf-ell" title={`${next.name} · ${next.clientName}`}>{`Next · ${next.name}`}</b>
                <span className="cf-ell">{`${perClient ? `${book.byId[next.clientId]?.short ?? next.clientName} · ` : ''}${dDay(next.due, today)}`}</span>
              </span>
            </button>
          ) : null}
          {filtersOn ? (
            <button type="button" className="link" onClick={() => setParams({ status: null, area: null })}>
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      <section className="glass panel mx-p">
        <div className="ph">
          <div className="mx-pt">
            <h3>{title}</h3>
            <span className="small">
              {data.loading
                ? 'Loading…'
                : `${plural(sheet.length, 'row')}${filterWords ? ` · ${filterWords}` : ''}${matrix ? ' · click a cell for the filing' : ' · grouped by due date'}`}
            </span>
          </div>
          <span className="sp" />
          {cadence === 'monthly' ? (
            <>
              {!fullYear ? (
                <div className="mx-mnav">
                  <button type="button" className="ib sm" aria-label="Previous month" disabled={monthIndex <= 0} onClick={() => setParams({ period: months[monthIndex - 1]!.key, fy: String(fy) })}>
                    <Icon name="back" />
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    aria-label="Pick a month"
                    onClick={(e) => openPop(e.currentTarget, <MonthPick value={monthKey} onPick={(k) => setParams({ period: k, fy: String(fyStartOfMonth(k)) })} />, { cls: 'mx-narrow' })}
                  >
                    {monthLong(monthKey)}
                    <Icon name="down" size={12} />
                  </button>
                  <button
                    type="button"
                    className="ib sm"
                    aria-label="Next month"
                    disabled={monthIndex < 0 || monthIndex >= months.length - 1}
                    onClick={() => setParams({ period: months[monthIndex + 1]!.key, fy: String(fy) })}
                  >
                    <Icon name="chev" />
                  </button>
                </div>
              ) : null}
              <Seg<'month' | 'year'>
                className="sm"
                ariaLabel="Month or the full year"
                value={fullYear ? 'year' : 'month'}
                onChange={(v) => setParams({ view: v === 'year' ? 'year' : null })}
                options={[
                  { value: 'month', label: 'This month' },
                  { value: 'year', label: 'Full year' },
                ]}
              />
            </>
          ) : null}
        </div>

        {data.loading ? (
          <div className="sec-load">Loading the register…</div>
        ) : data.error ? (
          <SecError message="Could not load the register. Please try again in a moment." onRetry={data.retry} />
        ) : matrix ? (
          matrix.rows.length ? (
            <Matrix cols={matrix.cols} rows={matrix.rows} today={today} quarterly={cadence === 'quarterly'} onOpen={openRow} />
          ) : (
            <Empty title={`No ${CADENCE_LABEL[cadence].toLowerCase()} filings in ${book.fyLabel}${filterWords ? ' for these filters' : ''}`} sub="The register fills in as each registration goes live." />
          )
        ) : sheet.length ? (
          <Grouped rows={sheet} byId={book.byId} today={today} perClient={perClient} mayWrite={mayWrite} enriched={book.enriched} fy={fy} onOpen={openRow} onPick={(id) => setParams({ company: id })} />
        ) : (
          <Empty
            title={`No filings recorded for ${cadence === 'monthly' ? monthLong(monthKey) : book.fyLabel}${filterWords ? ' with these filters' : ''}`}
            sub={
              listed.length && cadence === 'monthly'
                ? `${plural(listed.length, 'row')} match in other months · switch to Full year to see them.`
                : 'The register fills in as each registration goes live.'
            }
          />
        )}
        <div className="mx-phleg cf-leg" aria-label="What the marks mean">
          {C_ORDER.map((s) => (
            <span key={s} title={C_TIP[s]}>
              <i className="cf-sw" style={{ background: C_COLOR[s] }} />
              {C_LABEL[s]}
            </span>
          ))}
          <span title="The working window the manager set for the filing">
            <Icon name="cal" size={12} />
            Window
          </span>
        </div>
      </section>
    </>
  );
}

/* ================================================================ grouped by due date (prototype) */

function Grouped({
  rows,
  byId,
  today,
  perClient,
  mayWrite,
  enriched,
  fy,
  onOpen,
  onPick,
}: {
  rows: CRow[];
  byId: Record<string, BookClient>;
  today: string;
  perClient: boolean;
  mayWrite: boolean;
  enriched: boolean;
  fy: number;
  onOpen: (r: CRow, el: Element | null) => void;
  onPick: (clientId: string) => void;
}) {
  const days = [...byDay(rows).entries()];
  return (
    <div>
      {days.map(([d, list]) => {
        const w = worstOf(list.map((r) => r.st)) ?? 'u';
        return (
          <div key={d} className="mx-fgrp">
            <div className={'mx-fgh2 s-' + w}>
              <span className={'mx-dtile' + (w === 'o' ? ' red' : '')} aria-hidden="true">
                <b>{Number(d.slice(8, 10))}</b>
                <small>{MON[Number(d.slice(5, 7)) - 1]}</small>
              </span>
              <b>{`${dDay(d, today)}${d === today ? ' · today' : ''}`}</b>
              <span className="small">{plural(list.length, 'filing')}</span>
            </div>
            {list.map((r) => (
              <FRow key={r.id} r={r} c={byId[r.clientId]} today={today} perClient={perClient} mayWrite={mayWrite} enriched={enriched} fy={fy} onOpen={onOpen} onPick={onPick} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FRow({
  r,
  c,
  today,
  perClient,
  mayWrite,
  enriched,
  fy,
  onOpen,
  onPick,
}: {
  r: CRow;
  c?: BookClient;
  today: string;
  perClient: boolean;
  mayWrite: boolean;
  enriched: boolean;
  fy: number;
  onOpen: (r: CRow, el: Element | null) => void;
  onPick: (clientId: string) => void;
}) {
  const { openPop, openModal } = useConsole();
  const markFiled = useMarkFiled();
  let moves: ReactNode;
  if (r.cal) moves = <span className="small" title={C_TIP.c}>Not on the register yet</span>;
  else
    moves = (
      <>
        {r.filedOn ? (
          enriched && r.proofs ? (
            <button type="button" className="pill ok cf-pb" title="Open the filing and its proofs" onClick={(e) => onOpen(r, e.currentTarget)}>
              <Icon name="doc" />
              {r.proofs > 1 ? `Proof · ${r.proofs}` : 'Proof'}
            </button>
          ) : enriched ? (
            <span className="small">Proof pending</span>
          ) : null
        ) : mayWrite ? (
          <Btn cls="sm" ico="check" onClick={() => void markFiled(r, today)}>
            Mark filed
          </Btn>
        ) : null}
        {mayWrite ? (
          <button type="button" className="ib sm" aria-label={`Proof and details · ${r.name}`} title="Proof and details" onClick={() => openModal(<ProofEditor id={r.id} fy={fy} />, { label: 'Proof and details' })}>
            <Icon name="up" />
          </button>
        ) : null}
        <ReminderBtn r={r} small />
      </>
    );
  const sub = [r.period, r.freqLabel, r.authorityName].filter(Boolean).join(' · ');
  return (
    <div className={'mx-frow s-' + r.st}>
      {perClient ? (
        <button type="button" className="mx-tc3 cf-cli" title={`Show only ${r.clientName}`} onClick={() => onPick(r.clientId)}>
          <ClientAv id={r.clientId} label={c?.initials ?? r.clientName.slice(0, 2).toUpperCase()} />
          <span>
            <b className="cf-ell">{c?.short ?? r.clientName}</b>
            <span className="small cf-ell">{c?.leadName ? `Lead ${c.leadName.split(/\s+/)[0]}` : 'No lead'}</span>
          </span>
        </button>
      ) : (
        <span className="mx-tc3">
          <ClientAv id={r.clientId} label={c?.initials ?? r.clientName.slice(0, 2).toUpperCase()} />
          <span>
            <b className="cf-ell">{c?.short ?? r.clientName}</b>
            <span className="small cf-ell">{c?.leadName ? `Lead ${c.leadName.split(/\s+/)[0]}` : 'No lead'}</span>
          </span>
        </span>
      )}
      <span className="mx-tc1">
        <span className="mx-chips">
          <LawTag area={r.area} tag={r.area} />
          <button type="button" className="cf-fn" title={`${r.particular} · open the filing`} onClick={(e) => onOpen(r, e.currentTarget)}>
            <b className="cf-ell">{r.name}</b>
          </button>
        </span>
        <span className="small cf-ell" title={sub}>
          {sub}
        </span>
      </span>
      <span className="cf-fd">
        <span className={'small' + (r.st === 'l' ? ' red' : '')}>
          {r.filedOn ? `Filed ${dShort(r.filedOn, today)}${r.st === 'l' ? ` · ${late(daysBetween(r.due, r.filedOn))}` : ''}` : r.cal ? 'SBC calendar' : 'Not filed yet'}
        </span>
        {r.cal ? null : mayWrite ? (
          <button type="button" className="cf-win" title="Set or clear the working window" onClick={(e) => openPop(e.currentTarget, <WindowPop id={r.id} fy={fy} />)}>
            <Icon name="cal" size={12} />
            {r.window ? winShort(r.window, today) : 'Set window'}
          </button>
        ) : r.window ? (
          <span className="cf-win ro" title="The working window the manager set">
            <Icon name="cal" size={12} />
            {winShort(r.window, today)}
          </span>
        ) : null}
      </span>
      <span className="cf-st">
        <StPill st={r.st} />
        {r.st === 'o' || r.st === 'd' ? <span className={'small' + (r.st === 'o' ? ' red' : '')}>{whenText(r, today)}</span> : null}
      </span>
      <span className="mx-moves">{moves}</span>
    </div>
  );
}

/* ================================================================ period sheets (live Full year / Quarterly) */

function Matrix({
  cols,
  rows,
  today,
  quarterly,
  onOpen,
}: {
  cols: Array<{ key: string; label: string; sub?: string; now: boolean }>;
  rows: MxRow[];
  today: string;
  quarterly: boolean;
  onOpen: (r: CRow, el: Element | null) => void;
}) {
  return (
    <div className="cf-scrollx">
      <div className="cf-mx" style={{ gridTemplateColumns: `minmax(200px, 1.6fr) repeat(${cols.length}, minmax(${quarterly ? 96 : 62}px, 1fr))` }}>
        <span className="cf-mxh">Filing</span>
        {cols.map((c) => (
          <span key={c.key} className={'cf-mxh' + (c.now ? ' now' : '')}>
            {c.label}
            {c.sub ? <small>{c.sub}</small> : null}
          </span>
        ))}
        {rows.map((m) => (
          <MxLine key={m.key} m={m} cols={cols} today={today} quarterly={quarterly} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function MxLine({ m, cols, today, quarterly, onOpen }: { m: MxRow; cols: Array<{ key: string; now: boolean }>; today: string; quarterly: boolean; onOpen: (r: CRow, el: Element | null) => void }) {
  return (
    <>
      <span className="cf-mxn">
        <LawTag area={m.area} tag={m.area} />
        <span className="mx-dt">
          <b className="cf-ell" title={m.name}>
            {m.name}
          </b>
          <span className="cf-ell">{`${m.clientName ? `${m.clientName} · ` : ''}${AREA_LABEL[m.area]}`}</span>
        </span>
      </span>
      {m.cells.map((cell, i) =>
        cell ? (
          <button
            key={cols[i]!.key}
            type="button"
            className={'cf-mc s-' + cell.st + (cols[i]!.now ? ' now' : '')}
            title={`${cell.name} · ${cell.clientName} · due ${dShort(cell.due, today)}${cell.filedOn ? ` · filed ${dShort(cell.filedOn, today)}` : ''} · ${C_LABEL[cell.st]}`}
            onClick={(e) => onOpen(cell, e.currentTarget)}
          >
            <b>{dShort(cell.due, today)}</b>
            <span>{quarterly ? (cell.filedOn ? `Filed ${dShort(cell.filedOn, today)}` : C_SHORT[cell.st]) : C_SHORT[cell.st]}</span>
          </button>
        ) : (
          <span key={cols[i]!.key} className={'cf-mc x' + (cols[i]!.now ? ' now' : '')} title="Nothing due in this period" />
        ),
      )}
    </>
  );
}

