'use client';

/**
 * Filing matrix (prototype mxMatrix — "Clients × filings" and "Compliance
 * health" in one panel): every compliance client against this month's filings
 * from the register, beside a ring of the month by status and the filings that
 * need action next (any month).
 */
import { SecError, SecLoading } from '@/components/portal/ui';
import { Donut, Empty, GoArrow, Icon, Legend, Panel } from '../../ui';
import { Drill, PopHead } from '../../overlays';
import { useConsole } from '../../runtime';
import { CDot, fRows } from './bits';
import { F_COLOR, F_LABEL, F_ORDER, dDay, dShort, late, plural, type FSt, type FView, type TodayModel } from './model';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A column head short enough for a cell: the form code when the name carries one. */
export function shortFiling(particular: string): string {
  const inner = /\(([^)]*\d[^)]*)\)/.exec(particular)?.[1];
  if (inner && /[A-Z]{2,}/.test(inner)) return inner.replace(/\s*KYC$/i, ' KYC').trim();
  const code = /\b([A-Z]{2,}[A-Z0-9]*(?:-[A-Z0-9]+)?)\b/.exec(particular)?.[1];
  if (code && code !== 'TDS' && /\d/.test(code)) return code;
  if (code) return code;
  return particular.split(/\s+/).slice(0, 2).join(' ');
}

function explain(f: FView, today: string): string {
  switch (f.st) {
    case 'o':
      return `Not filed. It was due on ${dShort(f.due, today)}, ${late(-f.days)}.`;
    case 'd':
      return `Due ${f.days === 0 ? 'today' : dDay(f.due, today)}. Not filed yet.`;
    case 'u':
      return `Due ${dShort(f.due, today)}. Not due yet.`;
    case 'f':
      return `Filed on ${dShort(f.filedOn!, today)}, on time.`;
    case 'l':
      return `Filed on ${dShort(f.filedOn!, today)}, after its due date of ${dShort(f.due, today)}.`;
  }
}

export function Matrix({ m, filings }: { m: TodayModel; filings: { loading: boolean; error: boolean; retry: () => void } }) {
  const { go, base, openPop, closePop } = useConsole();
  const cmp = m.clients.filter((c) => c.stage === 'cmp');
  const rows = m.monthRows;
  const cols = [...new Set(rows.map((f) => f.row.particular))]
    .map((particular) => {
      const of = rows.filter((f) => f.row.particular === particular);
      const days = [...new Set(of.map((f) => Number(f.due.slice(8, 10))))].sort((a, b) => a - b);
      return { particular, short: shortFiling(particular), days, first: Math.min(...days) };
    })
    .sort((a, b) => a.first - b.first || a.short.localeCompare(b.short));
  const parts = F_ORDER.map((s) => ({ n: m.practice.monthCounts[s], color: F_COLOR[s], label: F_LABEL[s] }));
  const total = rows.length;
  const filed = m.practice.monthCounts.f + m.practice.monthCounts.l;
  const next = m.filings
    .filter((f) => f.st === 'o' || f.st === 'd')
    .sort((a, b) => (a.st === 'o' ? 0 : 1) - (b.st === 'o' ? 0 : 1) || a.due.localeCompare(b.due))
    .slice(0, 3);
  const monShort = MON[Number(m.monthKey.slice(5, 7)) - 1];

  const drill = (i: number, el: Element | null) =>
    openPop(
      el,
      <Drill
        title={`Compliance health · ${m.month}`}
        sub={`${plural(total, 'filing')} across ${plural(new Set(rows.map((f) => f.clientId)).size, 'client')}`}
        active={i + 1}
        tabs={[
          { label: 'All', rows: fRows(base, [...rows].sort((a, b) => F_ORDER.indexOf(a.st) - F_ORDER.indexOf(b.st) || a.due.localeCompare(b.due)), m, go) },
          ...F_ORDER.map((s) => ({ label: F_LABEL[s], color: F_COLOR[s], rows: fRows(base, rows.filter((f) => f.st === s), m, go) })),
        ]}
        link={{ text: 'Open filings', onClick: () => go(`${base}/compliances/filings`) }}
      />,
      { cls: 'mx-wide' },
    );

  const cellPop = (f: FView, el: Element) => {
    const c = m.byId[f.clientId];
    openPop(
      el,
      <div>
        <PopHead title={`${f.name} · ${c?.short ?? ''}`} sub={`${F_LABEL[f.st]} · due ${dShort(f.due, m.today)}`} />
        <p className="small" style={{ margin: '10px 0' }}>
          {explain(f, m.today)}
        </p>
        <div className="pop-foot">
          <span className="small">{f.areaLabel}</span>
          <span className="sp" />
          <GoArrow
            label="Open filings"
            onClick={() => {
              closePop();
              go(`${base}/compliances/filings`);
            }}
          />
        </div>
      </div>,
    );
  };

  return (
    <Panel
      id="mx-matrix"
      need="cmp"
      title={`Filing matrix · ${m.month}`}
      sub="Every compliance client against this month's filings · hover a cell for its status"
      act={
        <button type="button" className="link" onClick={() => go(`${base}/compliances/calendar`)}>
          Calendar
          <Icon name="chev" size={16} />
        </button>
      }
    >
      {filings.loading ? (
        <SecLoading label="Loading the filings register…" />
      ) : filings.error ? (
        <SecError message="The filings register could not load." onRetry={filings.retry} />
      ) : (
        <div className="mx-mxg">
          <div>
            {cols.length ? (
              <div className="tdy-scrollx">
                <div className="mx-fg" style={{ gridTemplateColumns: `130px repeat(${cols.length}, minmax(56px, 88px))` }}>
                  <span />
                  {cols.map((col) => (
                    <span key={col.particular} className="mx-fgh" title={`${col.particular} · due ${col.days.map((d) => `${d} ${monShort}`).join(', ')}`}>
                      <span className="tdy-ell">{col.short}</span>
                      <small>{col.days.join(', ')}</small>
                    </span>
                  ))}
                  {cmp.map((c) => (
                    <FRow key={c.id} cId={c.id} m={m} cols={cols.map((x) => x.particular)} onCell={cellPop} />
                  ))}
                </div>
              </div>
            ) : (
              <Empty title={`No filings due in ${m.month}`} sub="The register has nothing due this month for these clients." />
            )}
            <div className="mx-phleg" aria-label="What the cells mean">
              {(['f', 'l', 'd', 'o', 'u'] as FSt[]).map((s) => (
                <span key={s}>
                  <i className={'mx-fgc ' + s} />
                  {s === 'd' ? 'Due this week (day shown)' : F_LABEL[s]}
                </span>
              ))}
              <span>
                <i className="mx-fgc x" />
                Not due this month
              </span>
            </div>
          </div>
          <div className="mx-mxr">
            <div className="mx-ts">
              <Donut parts={parts} size={108} onPick={(i, el) => drill(i, el)} center={[total ? `${Math.round((filed / total) * 100)}%` : '–', 'filed']} />
              <Legend parts={parts} onPick={(i) => drill(i, null)} />
            </div>
            <div className="mx-sub-h">
              <span className="eyebrow">Needs action next</span>
            </div>
            {next.length ? (
              next.map((f) => {
                const c = m.byId[f.clientId];
                return (
                  <button key={f.id} type="button" className="mx-nf tdy-nf" onClick={() => go(`${base}/compliances/filings`)} title="Open the filings register">
                    <span className={'mx-dtile' + (f.st === 'o' ? ' red' : '')}>
                      <b>{Number(f.due.slice(8, 10))}</b>
                      <small>{MON[Number(f.due.slice(5, 7)) - 1]}</small>
                    </span>
                    <span className="mx-dt">
                      <b className="tdy-ell" title={f.name}>
                        {f.name}
                      </b>
                      <span className="tdy-ell">{c?.name}</span>
                    </span>
                    <span className={'pill ' + (f.st === 'o' ? 'over' : 'due')}>{f.st === 'o' ? 'Overdue' : f.days === 0 ? 'Due today' : `Due in ${f.days}d`}</span>
                  </button>
                );
              })
            ) : (
              <span className="small">Nothing is overdue or due this week.</span>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function FRow({ cId, m, cols, onCell }: { cId: string; m: TodayModel; cols: string[]; onCell: (f: FView, el: Element) => void }) {
  const c = m.byId[cId]!;
  return (
    <>
      <span className="mx-tc3">
        <CDot c={c} />
        <span className="tdy-ell" title={c.name}>
          {c.short}
        </span>
      </span>
      {cols.map((p) => {
        const f = m.monthRows.find((x) => x.clientId === cId && x.row.particular === p);
        if (!f) return <span key={p} className="mx-fgc x" title={`${c.short} · ${p} · not due this month`} />;
        const text = f.st === 'f' || f.st === 'l' ? '✓' : f.st === 'o' ? '!' : f.st === 'd' ? String(Number(f.due.slice(8, 10))) : '';
        return (
          <button key={p} type="button" className={'mx-fgc ' + f.st} title={`${c.name} · ${f.name} · ${F_LABEL[f.st]} · due ${dShort(f.due, m.today)}`} onClick={(e) => onCell(f, e.currentTarget)}>
            {text}
          </button>
        );
      })}
    </>
  );
}
