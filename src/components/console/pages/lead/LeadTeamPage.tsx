'use client';

/**
 * LEAD · TEAM (prototype #lsec-lteam): the people on the lead's clients — their
 * managers (from the intern-scoped directory, as the old "My managers" card)
 * and the co-leads (`/api/engagements/leads`) — with their real open work on
 * these clients. The prototype's "% loaded" has no source; the bar here is the
 * person's open items split into overdue, due this week and the rest, scaled
 * to the busiest person on the page (its title says so).
 */
import { useMemo, type CSSProperties } from 'react';
import { useApp } from '@/context/AppContext';
import { SecLoading } from '@/components/portal/ui';
import { Empty, Icon, hueOf } from '../../ui';
import { useConsole, useCrumbs } from '../../runtime';
import { useBookLeads } from '../today/useToday';
import { daysBetween, istDay, personInitials, plural, type TClient } from '../today/model';
import { useLeadDesk, useLeadManagers } from './useLead';
import '../../css/96-today.css';
import '../../css/96-lead.css';

interface Person {
  key: string;
  name: string;
  role: string;
  email?: string;
  clients: TClient[];
  over: number;
  due: number;
  rest: number;
  detail: string;
}

export function LeadTeamPage() {
  useCrumbs(['Team']);
  const { model: m, loading } = useLeadDesk();
  const { managers, loading: mgrLoading } = useLeadManagers(m);
  const leadsQ = useBookLeads();
  const { user, tasks } = useApp();
  const { go, base } = useConsole();

  const people = useMemo<Person[]>(() => {
    const ids = new Set(m.all.map((c) => c.id));
    const openTasksOf = (profileId?: string | null) =>
      profileId ? tasks.filter((t) => ids.has(t.engagementId) && t.assigneeId === profileId && t.status !== 'completed' && t.status !== 'not-applicable') : [];
    const split = (dues: Array<string | undefined>) => {
      let over = 0;
      let due = 0;
      for (const d of dues) {
        const n = d ? daysBetween(m.today, d) : undefined;
        if (n !== undefined && n < 0) over += 1;
        else if (n !== undefined && n <= 6) due += 1;
      }
      return { over, due, rest: dues.length - over - due };
    };
    const out: Person[] = [];
    for (const p of managers) {
      const clients = m.all.filter((c) => c.e.managerId === p.id);
      const waiting = m.queue.filter((q) => q.holder === 'mgr' && clients.some((c) => c.id === q.clientId));
      const own = openTasksOf(p.id);
      const s = split([...waiting.map((q) => q.due), ...own.map((t) => istDay(t.dueAt))]);
      out.push({
        key: `m:${p.id}`,
        name: p.name,
        role: 'Project manager',
        email: p.email,
        clients,
        ...s,
        detail: `${plural(waiting.length, 'approval')} waiting on them · ${plural(own.length, 'team task')}`,
      });
    }
    for (const l of leadsQ.data ?? []) {
      if (l.internId && l.internId === user?.internId) continue;
      const clients = m.all.filter((c) => c.e.internId === l.internId || (c.e.leadIds ?? []).includes(l.internId ?? ''));
      if (!clients.length) continue;
      const work = m.team.filter((t) => t.leadKey === l.internId && t.st !== 'done');
      const s = split(work.map((t) => t.due));
      const steps = work.filter((t) => t.kind === 'step').length;
      const filings = work.filter((t) => t.kind === 'filing').length;
      out.push({
        key: `l:${l.internId}`,
        name: l.name,
        role: 'Project lead',
        email: (l as { email?: string }).email,
        clients,
        ...s,
        detail: `${plural(steps, 'step')} · ${plural(filings, 'filing')} · ${plural(work.length - steps - filings, 'team task')}`,
      });
    }
    return out;
  }, [m, managers, leadsQ.data, tasks, user?.internId]);

  const max = Math.max(1, ...people.map((p) => p.over + p.due + p.rest));

  return (
    <>
      <div className="sec-h">
        <h2>Team</h2>
        <span className="sec-count">{loading || mgrLoading ? 'Loading…' : plural(people.length, 'person', 'people')}</span>
        <span className="sp" />
        <span className="small">The people on your clients and what is open with them</span>
      </div>
      {loading || mgrLoading ? (
        <SecLoading label="Loading your team…" />
      ) : people.length === 0 ? (
        <section className="glass panel">
          <Empty title="Nobody else on your clients yet" sub="Your managers and co-leads show here once they are on a client of yours." />
        </section>
      ) : (
        <div className="lteam">
          {people.map((p) => {
            const open = p.over + p.due + p.rest;
            const tip = `${open} open on your clients: ${p.over} overdue, ${p.due} due this week, ${p.rest} later or undated · the bar is scaled to the busiest person here (${max})`;
            return (
              <section key={p.key} className="glass tm">
                <div className="tm-h">
                  <span className="av" style={{ background: hueOf(p.key) }} aria-hidden="true">
                    {personInitials(p.name)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b className="tdy-ell" title={p.name}>
                      {p.name}
                    </b>
                    <span>{p.role}</span>
                  </div>
                  {p.email ? (
                    <button type="button" className="ib sm" aria-label={`Email ${p.name}`} title={`Email ${p.name}`} onClick={() => go(`${base}/mail?to=${encodeURIComponent(p.email!)}`)}>
                      <Icon name="mail" />
                    </button>
                  ) : null}
                </div>
                <div className="lc-row">
                  <span>Open on your clients</span>
                  <b style={p.over ? { color: 'var(--over-ink)' } : undefined}>{plural(open, 'item')}</b>
                </div>
                <div className="load" role="img" aria-label={tip} title={tip}>
                  {p.over ? <i style={{ width: `${(p.over / max) * 100}%`, background: 'var(--over)' }} /> : null}
                  {p.due ? <i style={{ width: `${(p.due / max) * 100}%`, background: 'var(--due)' }} /> : null}
                  {p.rest ? <i style={{ width: `${(p.rest / max) * 100}%`, background: 'var(--mx-run)' }} /> : null}
                </div>
                <div className="ccs">
                  {p.clients.map((c) => (
                    <button key={c.id} type="button" className="cc" style={{ ['--cc' as string]: hueOf(c.id) } as CSSProperties} title={`Open ${c.name}`} onClick={() => go(c.href)}>
                      <i />
                      {c.short}
                    </button>
                  ))}
                </div>
                <div className="small">{p.detail}</div>
              </section>
            );
          })}
        </div>
      )}
      <div className="mx-phleg" aria-label="What the bar colours mean">
        <span>
          <i className="tdy-sw" style={{ background: 'var(--over)' }} />
          Overdue
        </span>
        <span>
          <i className="tdy-sw" style={{ background: 'var(--due)' }} />
          Due this week
        </span>
        <span>
          <i className="tdy-sw" style={{ background: 'var(--mx-run)' }} />
          Later or undated
        </span>
      </div>
    </>
  );
}
