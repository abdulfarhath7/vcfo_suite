'use client';

/**
 * Sidebar · Clients (prototype mxNav client sub-list): four pinned clients,
 * most urgent first — overdue (a late step or an overdue filing), then waiting
 * on you (an approval), then due this week, then the next date — each with its
 * colour and an Inc / Cmp tag, and "View all N". Follows the Stage filter.
 */
import { usePathname } from 'next/navigation';
import { useConsole } from '../../runtime';
import { useToday } from '../../pages/today/useToday';
import { CDot } from '../../pages/today/bits';
import { daysBetween, dShort, plural, type TClient } from '../../pages/today/model';
import '../../css/96-today.css';

function urgency(c: TClient, today: string): { rank: number; why: string } {
  if (c.late) return { rank: 0, why: `${c.current?.title ?? 'A step'} is ${c.lateDays} days late` };
  if (c.overdue) return { rank: 0, why: `${plural(c.overdue, 'filing')} overdue` };
  if (c.mine) return { rank: 1, why: 'Waiting on your approval' };
  if (c.next && !c.next.overdue && daysBetween(today, c.next.iso) <= 6) return { rank: 2, why: `Due ${dShort(c.next.iso, today)} · ${c.next.what}` };
  return { rank: 3, why: c.next ? `Next: ${dShort(c.next.iso, today)} · ${c.next.what}` : c.healthWhy };
}

export function ClientsExtra() {
  const { model: m, loading } = useToday();
  const { go, base, seat } = useConsole();
  const pathname = usePathname() ?? '';
  const ranked = m.clients
    .map((c) => ({ c, u: urgency(c, m.today) }))
    .sort((a, b) => a.u.rank - b.u.rank || (a.c.next?.iso ?? '9999').localeCompare(b.c.next?.iso ?? '9999') || a.c.short.localeCompare(b.c.short))
    .slice(0, 4);

  return (
    <div className="sub mx-subl">
      {ranked.length === 0 ? <span className="small tdy-sbnote">{loading ? 'Loading…' : 'No clients in this view'}</span> : null}
      {ranked.map(({ c, u }) => {
        const on = pathname === c.href || pathname.startsWith(c.href + '/');
        return (
          <button key={c.id} type="button" className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} title={`${c.name} · ${u.why}`} onClick={() => go(c.href)}>
            <CDot c={c} />
            <span className="tdy-ell">{c.short}</span>
            <span className="mx-st" title={c.stage === 'inc' ? 'Incorporating' : 'Compliance'}>
              {c.stage === 'inc' ? 'Inc' : 'Cmp'}
            </span>
          </button>
        );
      })}
      <button type="button" className="mx-all" onClick={() => go(seat === 'lead' ? `${base}/clients` : `${base}/projects`)}>
        View all {m.clients.length}
      </button>
    </div>
  );
}
