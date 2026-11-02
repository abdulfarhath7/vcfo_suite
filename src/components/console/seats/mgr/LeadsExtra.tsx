'use client';

/**
 * Sidebar · Project leads (prototype mxNav lead sub-list): every lead on the
 * manager's clients with their open items — the same count as Today's lead
 * bars and orbit key (open team tasks, current steps and filings on their
 * clients, in the Stage filter). A click opens that lead on the Project leads
 * page (`?lead=<intern key>`).
 */
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { LeadAv } from '../../ui';
import { useConsole } from '../../runtime';
import { useToday } from '../../pages/today/useToday';
import { firstName, plural } from '../../pages/today/model';
import '../../css/96-today.css';

function Leads() {
  const { model: m, loading } = useToday();
  const { go, base } = useConsole();
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const current = pathname.startsWith(`${base}/leads`) ? params?.get('lead') : null;

  if (!m.leads.length) {
    return (
      <div className="sub mx-subl">
        <span className="small tdy-sbnote">{loading ? 'Loading…' : 'No project leads on your clients yet'}</span>
      </div>
    );
  }
  return (
    <div className="sub mx-subl">
      {m.leads.map((l) => (
        <button
          key={l.key}
          type="button"
          className={current === l.key ? 'on' : ''}
          aria-current={current === l.key ? 'page' : undefined}
          title={`${l.name} · ${plural(l.open.length, 'open item')}${l.overdue ? `, ${l.overdue} overdue` : ''}`}
          onClick={() => go(`${base}/leads?lead=${encodeURIComponent(l.key)}`)}
        >
          <LeadAv id={l.key} name={l.name} initials={l.initials} sm />
          <span className="tdy-ell">{firstName(l.name)}</span>
          <span className="mx-n" aria-label={plural(l.open.length, 'open item')}>
            {loading ? '…' : l.open.length}
          </span>
        </button>
      ))}
    </div>
  );
}

export function LeadsExtra() {
  return (
    <Suspense fallback={null}>
      <Leads />
    </Suspense>
  );
}
