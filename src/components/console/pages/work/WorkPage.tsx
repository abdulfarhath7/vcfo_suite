'use client';

/**
 * MY WORK — /app/manager/work (prototype mxRenderers.work): the manager's own
 * planner — your to-dos, the dates you set and what waits on you, across
 * every client in your book — as timeline, calendar, board or list.
 */
import { useCrumbs } from '../../runtime';
import { Planner } from './planner/Planner';
import { useLeadRows, usePlan } from './planner/data';
import { useWorkBadge } from './badges';

const ME = { mode: 'mgr-me' } as const;

export function WorkPage() {
  useCrumbs(['My work']);
  useWorkBadge();
  const { leads } = useLeadRows();
  const plan = usePlan(ME);
  const companies = new Set(plan.items.filter((i) => i.st !== 'done').map((i) => i.clientId)).size;
  return (
    <>
      <div className="sec-h">
        <h2>My work</h2>
        <span className="sec-count">{plan.loading ? 'Loading…' : `${companies} ${companies === 1 ? 'company' : 'companies'}`}</span>
        <span className="sp" />
        <span className="small">Your to-dos and the tasks whose dates you set, across every client</span>
      </div>
      <Planner who={ME} leads={leads} />
    </>
  );
}
