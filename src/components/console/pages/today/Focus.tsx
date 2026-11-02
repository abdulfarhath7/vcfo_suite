'use client';

/**
 * Focus (prototype mxFocus): one ranked list of what needs you or your leads —
 * approvals, each client's current step, filings overdue or due within two
 * weeks, open document requests — with a heat map (client × state) as a
 * second lens. A heat-map number ranks just those items.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { SecLoading } from '@/components/portal/ui';
import { Empty, Icon, Panel, Seg } from '../../ui';
import { useConsole } from '../../runtime';
import { CAv, jump } from './bits';
import { Q_COLOR, Q_LABEL, Q_ORDER, Q_TIP, dShort, plural, type QItem, type QState, type TodayModel } from './model';

const ROW_CLS: Record<QState, string> = { over: 'over', due: 'due', you: 'mine', wait: 'wait', up: 'up' };
const TOP = 7;

function meta(q: QItem, m: TodayModel): string {
  const c = m.byId[q.clientId];
  const step = q.stepId ? c?.model.byId[q.stepId] : undefined;
  return [c?.short, q.why, step ? `Phase ${step.phaseNo}` : '', q.since && q.state !== 'over' ? `since ${dShort(q.since, m.today)}` : '']
    .filter(Boolean)
    .join(' · ');
}

export function Focus({ m, loading }: { m: TodayModel; loading: boolean }) {
  const { go, base } = useConsole();
  const [lens, setLens] = useState<'rank' | 'heat'>('rank');
  const [sel, setSel] = useState('');
  const [all, setAll] = useState(false);

  const list = sel ? m.queue.filter((q) => `${q.clientId}|${q.state}` === sel) : m.queue;
  useEffect(() => {
    if (sel && list.length === 0) setSel('');
  }, [sel, list.length]);
  const shown = all || sel ? list : list.slice(0, TOP);
  const [selClient, selState] = sel.split('|') as [string, QState];

  const heatRows = m.clients
    .filter((c) => m.queue.some((q) => q.clientId === c.id))
    .sort((a, b) => {
      const worst = (id: string) => Math.min(...m.queue.filter((q) => q.clientId === id).map((q) => Q_ORDER.indexOf(q.state)));
      return worst(a.id) - worst(b.id) || a.short.localeCompare(b.short);
    });

  return (
    <Panel
      id="mx-focus"
      cls="mx-focusp"
      title="Focus"
      sub={loading ? 'Loading…' : `${plural(m.queue.length, 'item')} · ${m.kpi.over.length} overdue · ranked by urgency`}
      act={
        <div className="mx-filters">
          <Seg<'rank' | 'heat'>
            className="sm"
            ariaLabel="Focus view"
            value={lens}
            onChange={setLens}
            options={[
              { value: 'rank', label: 'Ranked' },
              { value: 'heat', label: 'Heat map' },
            ]}
          />
          <button type="button" className="link" onClick={() => go(`${base}/work`)}>
            All work
            <Icon name="chev" size={16} />
          </button>
        </div>
      }
    >
      {loading ? (
        <SecLoading label="Loading your book…" />
      ) : m.queue.length === 0 ? (
        <Empty title="Nothing needs you right now" sub="Approvals, current steps and filings due soon show up here as they come in." />
      ) : lens === 'heat' ? (
        <>
          <div className="tdy-scrollx">
          <div className="mx-hm tdy-hm" aria-label="Items by client and state">
            <div className="mx-hmh">
              <span />
              {Q_ORDER.map((s) => (
                <span key={s} style={{ color: Q_COLOR[s] }} title={Q_TIP[s]}>
                  {Q_LABEL[s]}
                </span>
              ))}
            </div>
            {heatRows.map((c) => {
              const mine = m.queue.filter((q) => q.clientId === c.id);
              return (
                <div className="mx-hmr" key={c.id}>
                  <span className="mx-hmc">
                    <CAv c={c} />
                    <span>
                      <b className="tdy-ell" title={c.name}>
                        {c.short}
                      </b>
                      <span className="small">{plural(mine.length, 'item')}</span>
                    </span>
                  </span>
                  {Q_ORDER.map((s) => {
                    const its = mine.filter((q) => q.state === s);
                    const n = its.length;
                    const key = `${c.id}|${s}`;
                    return (
                      <button
                        key={s}
                        type="button"
                        className={'mx-hmx' + (n ? '' : ' z') + (sel === key ? ' sel' : '')}
                        style={n ? ({ ['--hc' as string]: Q_COLOR[s], ['--hm' as string]: n > 1 ? '88%' : '55%' } as CSSProperties) : undefined}
                        disabled={!n}
                        aria-label={`${c.short} · ${Q_LABEL[s]} · ${n}`}
                        title={n ? `${c.name} · ${Q_LABEL[s]}: ${its.map((q) => q.title).join(', ')}` : `${c.short} · nothing here`}
                        onClick={() => {
                          setSel(sel === key ? '' : key);
                          setLens('rank');
                          window.setTimeout(() => jump('mx-focus'), 20);
                        }}
                      >
                        {n || ''}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          </div>
          <div className="mx-hint">
            <Icon name="help" />
            Darker means more. Click a number to rank just those items.
          </div>
        </>
      ) : (
        <>
          {sel ? (
            <div className="mx-fchip">
              Showing <b>{`${Q_LABEL[selState]} · ${m.byId[selClient]?.short ?? ''}`}</b>
              <button type="button" className="ib x" aria-label="Show every item" onClick={() => setSel('')}>
                <Icon name="x" />
              </button>
            </div>
          ) : null}
          <div className="mx-flist">
            {shown.map((q, i) => {
              const c = m.byId[q.clientId]!;
              return (
                <div key={q.id} className={'mx-fi ' + ROW_CLS[q.state]}>
                  <span className="mx-fr" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <CAv c={c} />
                  <span className="mx-dt">
                    <b>
                      {q.code ? <span className="mx-code">{q.code}</span> : null}
                      <span className="tdy-ell" title={q.title}>
                        {q.title}
                      </span>
                    </b>
                    <span title={meta(q, m)}>{meta(q, m)}</span>
                  </span>
                  <span className={'pill ' + q.pill} title={Q_TIP[q.state]}>
                    {q.status}
                  </span>
                  <button type="button" className={'btn sm' + (q.pri ? ' pri' : '')} onClick={() => go(q.cta.href)}>
                    {q.cta.label}
                  </button>
                </div>
              );
            })}
          </div>
          {!sel && list.length > TOP ? (
            <button type="button" className="mx-showall" onClick={() => setAll((v) => !v)}>
              {all ? `Show the top ${TOP}` : `Show all ${list.length}`}
            </button>
          ) : null}
        </>
      )}
    </Panel>
  );
}
