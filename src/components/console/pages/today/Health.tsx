'use client';

/**
 * Client health as tiles (prototype mxHealthTiles): a progress ring each —
 * the current phase for a client still in its steps, this month's filings for
 * one past them — who holds it, the next date and a health word with its
 * reason on hover. The stored "at risk" flag the team sets is kept.
 */
import type { CSSProperties } from 'react';
import { SecLoading } from '@/components/portal/ui';
import { Empty, Icon, Panel } from '../../ui';
import { useConsole } from '../../runtime';
import { Ring } from './bits';
import { HEALTH_COLOR, HEALTH_LABEL, HEALTH_RANK, HOLDER_LABEL, age, dShort, plural, type TClient, type TodayModel } from './model';

function progress(c: TClient, monthKey: string): { pct: number; label: string; title: string } {
  if (c.current) {
    const p = c.model.phases[c.phaseIdx]!;
    return { pct: (p.done / Math.max(1, p.total)) * 100, label: `${p.done}/${p.total} ${p.name}`, title: `${p.title}: ${p.done} of ${p.total} steps done` };
  }
  const month = c.filings.filter((f) => f.due.slice(0, 7) === monthKey);
  const filed = month.filter((f) => f.st === 'f' || f.st === 'l').length;
  if (!month.length) return { pct: 100, label: `All ${c.total} steps done`, title: `Every step is done · no filing due this month` };
  return {
    pct: (filed / month.length) * 100,
    label: `${plural(month.length, 'filing')} this month · ${c.overdue} overdue in all`,
    title: `${filed} of ${plural(month.length, 'filing')} due this month filed · ${c.overdue} overdue in all`,
  };
}

export function Health({ m, loading }: { m: TodayModel; loading: boolean }) {
  const { go, base } = useConsole();
  const tiles = [...m.clients].sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || a.short.localeCompare(b.short));
  const flagged = m.clients.filter((c) => c.health === 'stuck' || c.health === 'risk').length;

  return (
    <Panel
      id="mx-health"
      title="Client health"
      sub={loading ? 'Loading…' : `${plural(m.clients.length, 'client')} · ${flagged} stuck or at risk`}
      act={
        <button type="button" className="link" onClick={() => go(`${base}/projects`)}>
          All clients
          <Icon name="chev" size={16} />
        </button>
      }
    >
      {loading ? (
        <SecLoading label="Loading your clients…" />
      ) : tiles.length === 0 ? (
        <Empty title="No clients in this view" sub="Clients in the stage you picked show up here." />
      ) : (
        <div className="mx-htiles">
          {tiles.map((c) => {
            const p = progress(c, m.monthKey);
            const hc = HEALTH_COLOR[c.health];
            return (
              <button key={c.id} type="button" className="mx-ht2" style={{ ['--hc' as string]: hc } as CSSProperties} onClick={() => go(c.href)} title={`Open ${c.name}`}>
                <Ring pct={p.pct} color={hc} title={p.title} />
                <span className="mx-dt">
                  <b className="tdy-ell" title={c.name}>
                    {c.short}
                  </b>
                  <span className="tdy-ell" title={p.title}>
                    {p.label}
                  </span>
                  <span className="mx-chips">
                    {c.holder ? (
                      <span className={'pill ' + (c.holder === 'you' ? 'up' : 'mut')} title={`${HOLDER_LABEL[c.holder]} holds the current step`}>
                        {HOLDER_LABEL[c.holder]} · {age(c.heldDays ?? 0)}
                      </span>
                    ) : null}
                    {c.next ? (
                      <span className={'small' + (c.next.overdue ? ' red' : '')} title={c.next.overdue ? 'The oldest overdue date' : c.next.what}>
                        {c.next.overdue ? `Overdue since ${dShort(c.next.iso, m.today)}` : `${dShort(c.next.iso, m.today)} · ${c.next.what}`}
                      </span>
                    ) : (
                      <span className="small">No date ahead</span>
                    )}
                  </span>
                </span>
                <span className="mx-hh" title={c.healthWhy}>
                  <i style={{ background: hc }} />
                  {HEALTH_LABEL[c.health]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
