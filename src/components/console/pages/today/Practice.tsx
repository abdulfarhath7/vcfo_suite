'use client';

/**
 * Practice areas (prototype mxPractice): where the book stands in each line of
 * work — incorporation by pipeline stage (with the real average days to the
 * certificate, over companies incorporated here), registrations (Phase 4 of
 * the checklist) and this month's compliances from the register.
 *
 * The prototype's "target 30 days" has no source in the tool and is not shown.
 */
import { SecError, SecLoading } from '@/components/portal/ui';
import { Donut, Icon, Legend, Panel } from '../../ui';
import { Drill } from '../../overlays';
import { useConsole } from '../../runtime';
import { CDot, fRows } from './bits';
import { F_COLOR, F_LABEL, F_ORDER, HEALTH_COLOR, HEALTH_LABEL, plural, type TodayModel } from './model';

export function Practice({ m, loading, filings }: { m: TodayModel; loading: boolean; filings: { loading: boolean; error: boolean; retry: () => void } }) {
  const { go, base, openPop } = useConsole();
  const p = m.practice;
  const inc = m.clients.filter((c) => c.stage === 'inc');
  const cmp = m.clients.filter((c) => c.stage === 'cmp');
  const regTotal = p.regs.done + p.regs.run + p.regs.wait;
  const parts = F_ORDER.map((s) => ({ n: p.monthCounts[s], color: F_COLOR[s], label: F_LABEL[s] }));
  const total = m.monthRows.length;
  const filed = p.monthCounts.f + p.monthCounts.l;

  const pipeDrill = (i: number, el: Element) => {
    const stage = p.pipeline[i]!;
    openPop(
      el,
      <Drill
        title={`Incorporation · ${stage.label}`}
        sub={plural(stage.clients.length, 'client')}
        tabs={[
          {
            label: stage.label,
            rows: stage.clients.map((c) => ({
              id: c.id,
              title: c.name,
              meta: c.current ? `Now: ${c.current.title}` : 'Every step done',
              state: HEALTH_LABEL[c.health],
              color: HEALTH_COLOR[c.health],
              onOpen: () => go(c.href),
            })),
          },
        ]}
        link={{ text: 'Open clients', onClick: () => go(`${base}/projects`) }}
      />,
      { cls: 'mx-wide' },
    );
  };
  const filDrill = (i: number, el: Element | null) =>
    openPop(
      el,
      <Drill
        title={`Filings · ${m.month}`}
        sub={`${plural(total, 'filing')} across ${plural(new Set(m.monthRows.map((f) => f.clientId)).size, 'client')}`}
        active={i + 1}
        tabs={[{ label: 'All', rows: fRows(base, m.monthRows, m, go) }, ...F_ORDER.map((s) => ({ label: F_LABEL[s], color: F_COLOR[s], rows: fRows(base, m.monthRows.filter((f) => f.st === s), m, go) }))]}
        link={{ text: 'Open filings', onClick: () => go(`${base}/compliances/filings`) }}
      />,
      { cls: 'mx-wide' },
    );

  return (
    <Panel id="mx-practice" title="Practice areas" sub="Where your book stands in each line of work">
      {loading ? (
        <SecLoading label="Loading your book…" />
      ) : (
        <div className="mx-pas">
          <div className="mx-pa">
            <span className="eyebrow">Incorporation</span>
            <h4>{plural(inc.length, 'client')}</h4>
            <div>
              <div className="mx-pipe">
                {p.pipeline.map((s, i) => (
                  <button key={s.key} type="button" className="mx-pp tdy-pp" title={`${s.label}: ${s.clients.map((c) => c.short).join(', ') || 'none'} · open the list`} onClick={(e) => pipeDrill(i, e.currentTarget)}>
                    <b>{s.clients.length}</b>
                    <span>{s.label}</span>
                    <span className="mx-ppd">
                      {s.clients.map((c) => (
                        <CDot key={c.id} c={c} />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mx-pam">
                {p.avgDaysToCoi !== null ? (
                  <>
                    <span>Average days to COI</span>
                    <b>{plural(p.avgDaysToCoi, 'day')}</b>
                    <span className="small">over {plural(p.coiCount, 'company', 'companies')} incorporated here</span>
                  </>
                ) : (
                  <span>No company has reached its certificate here yet.</span>
                )}
              </div>
            </div>
            <button type="button" className="link" onClick={() => go(`${base}/projects`)}>
              Open clients
              <Icon name="chev" size={16} />
            </button>
          </div>
          <div className="mx-pa">
            <span className="eyebrow">Registrations</span>
            <h4>
              {p.regs.done} done · {p.regs.run} in progress · {p.regs.wait} waiting on client
            </h4>
            <div>
              <div className="mx-regbar" role="img" aria-label={`${p.regs.done} done, ${p.regs.run} in progress, ${p.regs.wait} waiting on client`}>
                {(
                  [
                    ['Done', p.regs.done, 'var(--mx-ok)'],
                    ['In progress', p.regs.run, 'var(--mx-run)'],
                    ['Waiting on client', p.regs.wait, 'var(--mx-wait)'],
                  ] as Array<[string, number, string]>
                ).map(([l, n, c]) => (
                  <i key={l} style={{ flex: n || 0.001, background: c }} title={`${l} · ${n}`} />
                ))}
              </div>
              {cmp.length === 0 ? (
                <div className="mx-pam">
                  <span>No compliance clients in this view.</span>
                </div>
              ) : regTotal === 0 ? (
                <div className="mx-pam">
                  <span>No registration step has started yet.</span>
                </div>
              ) : (
                <>
                  {p.regs.top.length ? (
                    <div className="mx-tops">
                      {p.regs.top.map((t) => (
                        <span key={t.title} className="pill mut">
                          {t.title}
                          <b>&nbsp;{t.n} open</b>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mx-pam">
                      <span>Every registration step is done.</span>
                    </div>
                  )}
                  {p.regs.mostWaiting ? (
                    <div className="mx-pam">
                      <span>Most waiting</span>
                      <b>{p.regs.mostWaiting.title}</b>
                      <span className="small">{plural(p.regs.mostWaiting.n, 'client')} owe documents</span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <button type="button" className="link" onClick={() => go(`${base}/projects`)}>
              Open clients
              <Icon name="chev" size={16} />
            </button>
          </div>
          <div className="mx-pa">
            <span className="eyebrow">Compliances · {m.month}</span>
            <h4>{filings.loading ? 'Loading…' : plural(total, 'filing')}</h4>
            {filings.loading ? (
              <SecLoading label="Loading the filings register…" />
            ) : filings.error ? (
              <SecError message="The filings register could not load." onRetry={filings.retry} />
            ) : (
              <div className="mx-pad">
                <Donut parts={parts} size={92} onPick={(i, el) => filDrill(i, el)} center={[filed, 'filed']} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Legend parts={parts.filter((x) => x.n)} onPick={(i) => filDrill(F_ORDER.indexOf(F_ORDER.filter((s) => p.monthCounts[s])[i]!), null)} />
                  {p.worstArea ? (
                    <div className="mx-pam">
                      <span>Most overdue</span>
                      <b>{p.worstArea.label}</b>
                      <span className="small">{p.worstArea.n} overdue, any month</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            <button type="button" className="link" onClick={() => go(`${base}/compliances/calendar`)}>
              Open calendar
              <Icon name="chev" size={16} />
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
