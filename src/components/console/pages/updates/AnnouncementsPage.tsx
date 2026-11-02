'use client';

/**
 * ANNOUNCEMENTS (prototype mxRenderers.anns: a countdown and a wall of cards),
 * with every function of the live board (src/views/announcements):
 *   - the firm-wide board (posts by managers and admins + approved official
 *     updates), All / Important / General, unread marks of this person;
 *   - a card opens its pop-up and marks it read; Mark read; the source link;
 *   - New announcement and Remove for managers and admins (?compose=1 opens it);
 *   - Official portals & circulars (live directory, open/closed groups);
 *   - Official sources we watch, with the review queue's count (staff).
 * Added from the prototype, on real data: the next filing deadline (register).
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import {
  announcementMatchesFilter,
  canManageAnnouncementSources,
  canWriteAnnouncements,
  requestAnnouncementPopup,
  type Announcement,
  type AnnouncementListFilter,
} from '@/lib/announcements';
import { useAnnouncements } from '@/lib/use-announcements';
import { useFilings } from '@/lib/use-filings';
import { groupedVcfoPortalTasks, type VcfoPortalHead } from '@/lib/announcement-portals';
import { useAskOptional } from '@/components/ask/ask-context';
import { useConsole, useCrumbs } from '../../runtime';
import { Menu } from '../../overlays';
import { Btn, Empty, Icon, Panel, Seg } from '../../ui';
import { AnnKind, annFrom, ComposeModal } from './bits';
import { useAnnouncementReads, useRegulatoryPending } from './data';
import { annStripe, canSeeRegulatory, dDayLabel, dayTile, istToday, nextDeadline, overdueFilings, plural } from './model';

const RECURRING = new Set<VcfoPortalHead>(['Monthly Compliances', 'Quarterly Compliances', 'Half-yearly Compliances', 'Yearly Compliances']);
const OPEN_FIRST = new Set<VcfoPortalHead>(['Incorporation', 'Registrations', 'Monthly Compliances']);

function ComposeFromQuery({ canWrite }: { canWrite: boolean }) {
  const params = useSearchParams();
  const { openModal } = useConsole();
  const want = canWrite && params?.get('compose') === '1';
  useEffect(() => {
    if (want) openModal(<ComposeModal />, { label: 'New announcement' });
  }, [want, openModal]);
  return null;
}

function NextDeadlineCard() {
  const { base, go, scope } = useConsole();
  const filings = useFilings();
  const today = istToday(Date.now());
  const rows = filings.data?.rows ?? [];
  const next = useMemo(() => nextDeadline(rows, today), [rows, today]);
  const late = useMemo(() => overdueFilings(rows, today).length, [rows, today]);
  if (scope === 'inc' || !next) return null;
  const soon = next.days <= 7;
  return (
    <section className="glass mx-count">
      <div className={'mx-cn' + (soon ? '' : ' upd-far')} title={soon ? 'Due within a week' : 'More than a week away'}>
        <b>{next.days}</b>
        <span>{next.days === 0 ? 'today' : next.days === 1 ? 'day' : 'days'}</span>
      </div>
      <div className="mx-dt">
        <span className="eyebrow">Next deadline · {dDayLabel(next.due, today)}</span>
        <h3>
          {next.name}
          {next.period ? ` · ${next.period}` : ''}
        </h3>
        <span className="upd-ell" title={next.companies.join(', ')}>
          {plural(next.companies.length, 'client')} · {next.companies.join(', ')}
          {late ? ` · ${plural(late, 'filing')} overdue` : ''}
        </span>
      </div>
      <Btn cls="pri" ico="cal" onClick={() => go(`${base}/compliances/calendar`)}>
        Open the calendar
      </Btn>
    </section>
  );
}

function AnnCard({ a, unread, canWrite, onRead, onRemove }: { a: Announcement; unread: boolean; canWrite: boolean; onRead: () => void; onRemove: (el: Element) => void }) {
  const { go, base } = useConsole();
  const t = dayTile(a.publishedAt);
  const body = a.body.trim();
  return (
    <article className={'glass mx-acard' + (unread ? ' un' : '')} style={{ ['--kc' as string]: annStripe(a.kind) }}>
      <div className="mx-ach">
        <span className="mx-dtile" aria-hidden="true">
          <b>{t.d}</b>
          <small>{t.mon}</small>
        </span>
        <span className="mx-dt">
          <AnnKind kind={a.kind} />
          <span className="upd-ell" title={annFrom(a)}>
            {annFrom(a)}
          </span>
        </span>
        {unread ? <i className="mx-ud" title="Unread" /> : null}
      </div>
      <h3>
        <button type="button" className="upd-cardt" onClick={onRead}>
          {a.title}
        </button>
      </h3>
      {body && body !== a.title ? <p>{body}</p> : null}
      <div className="mx-acf">
        <button type="button" className="link" onClick={onRead}>
          {unread ? 'Mark read' : 'Read'}
        </button>
        <span className="sp" />
        {a.sourceUrl ? (
          <a className="btn sm" href={a.sourceUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="ext" />
            Source
          </a>
        ) : null}
        {a.kind === 'deadline' ? (
          <Btn cls="sm" ico="cal" onClick={() => go(`${base}/compliances/calendar`)}>
            Calendar
          </Btn>
        ) : null}
        {canWrite ? (
          <button type="button" className="btn sm danger-ghost" onClick={(e) => onRemove(e.currentTarget)}>
            Remove
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Portals() {
  const groups = groupedVcfoPortalTasks();
  const bands: Array<[string, typeof groups]> = [
    ['Setup & filings', groups.filter((g) => !RECURRING.has(g.head))],
    ['Recurring', groups.filter((g) => RECURRING.has(g.head))],
  ];
  return (
    <>
      <div className="sec-h upd-sec2">
        <h2 className="mx-h3">Official portals &amp; circulars</h2>
        <span className="small">Where the filings happen, and where the rules are published</span>
      </div>
      {bands.map(([label, gs]) => (
        <div key={label} className="upd-band">
          <span className="eyebrow">{label}</span>
          <div className="upd-portals">
            {gs.map((g) => (
              <details key={g.head} className="glass mx-ptile upd-ptile" open={OPEN_FIRST.has(g.head)}>
                <summary>
                  <b>{g.head}</b>
                  <span className="small">{plural(g.tasks.length, 'task')}</span>
                  <Icon name="down" />
                </summary>
                <ul>
                  {g.tasks.map((t) => (
                    <li key={t.task}>
                      <span className="upd-ell" title={t.task}>
                        {t.task}
                      </span>
                      {t.portalUrl ? (
                        <a className="link" href={t.portalUrl} target="_blank" rel="noopener noreferrer">
                          Portal
                          <Icon name="ext" size={13} />
                        </a>
                      ) : null}
                      {t.circularUrl ? (
                        <a className="link" href={t.circularUrl} target="_blank" rel="noopener noreferrer">
                          Circular
                          <Icon name="ext" size={13} />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

type Watcher = { id: string; label: string; act: string; homeUrl: string };

function WatchedSources() {
  const { user } = useApp();
  const { go, base } = useConsole();
  const watchers = useQuery({
    queryKey: ['ask', 'feeds'],
    queryFn: async () => {
      const res = await fetch('/api/ask/admin/feeds');
      const body = (await res.json().catch(() => null)) as { watchers?: Watcher[]; error?: string } | null;
      if (!res.ok) throw new Error(body?.error || 'Could not load the watched sources');
      return body as { watchers: Watcher[] };
    },
    staleTime: 10 * 60_000,
  });
  const pending = useRegulatoryPending(user?.role);
  const review = canSeeRegulatory(user?.role);
  return (
    <Panel
      title="Official sources we watch"
      sub="Checked every 30 minutes. A new notification or circular becomes a review document and waits for a manager; once approved it is posted here, everyone is told, and Ask VCFO answers from it."
      act={
        review ? (
          <Btn cls="sm" ico="globe" onClick={() => go(`${base}/regulatory-updates`)}>
            {typeof pending.data === 'number' ? `Review queue · ${pending.data} waiting` : 'Review queue'}
          </Btn>
        ) : undefined
      }
    >
      {watchers.isLoading ? <p className="small">Loading the sources…</p> : null}
      {watchers.isError ? (
        <p className="upd-err" role="alert">
          {(watchers.error as Error).message}{' '}
          <button type="button" className="link" onClick={() => void watchers.refetch()}>
            Try again
          </button>
        </p>
      ) : null}
      <div className="upd-watch">
        {(watchers.data?.watchers ?? []).map((w) => (
          <div key={w.id} className="mx-qi">
            <span className="pill mut">{w.act}</span>
            <a className="upd-ell" href={w.homeUrl} target="_blank" rel="noreferrer" title={w.label}>
              {w.label}
            </a>
          </div>
        ))}
      </div>
      <p className="small upd-note">MCA notifications are read from the Gazette of India, where the ministry publishes them, because mca.gov.in refuses automated readers.</p>
    </Panel>
  );
}

export function AnnouncementsPage() {
  useCrumbs(['Announcements']);
  const { user } = useApp();
  const { openModal, openPop, toast, openChat } = useConsole();
  const ask = useAskOptional();
  const qc = useQueryClient();
  const list = useAnnouncements();
  const { readIds, markRead } = useAnnouncementReads(user?.id);
  const [tab, setTab] = useState<AnnouncementListFilter>('all');
  const canWrite = canWriteAnnouncements(user?.role);
  const items = list.data?.announcements ?? [];
  const shown = items.filter((a) => announcementMatchesFilter(a.kind, tab));
  const unread = items.filter((a) => !readIds.has(a.id)).length;

  const compose = () => openModal(<ComposeModal />, { label: 'New announcement' });
  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'delete_failed');
      toast('Announcement removed');
      await qc.invalidateQueries({ queryKey: ['announcements'] });
      await qc.invalidateQueries({ queryKey: ['announcements-head'] });
    } catch (e) {
      toast(`Could not remove it: ${(e instanceof Error ? e.message : 'try again').replaceAll('_', ' ')}`);
    }
  };
  const confirmRemove = (a: Announcement, el: Element) =>
    openPop(
      el,
      <Menu
        title="Remove this announcement?"
        items={[
          { label: 'Remove for everyone', sub: 'It leaves every board, staff and clients', ico: 'x', danger: true, onSelect: () => void remove(a.id) },
          { label: 'Keep it', ico: 'back', onSelect: () => undefined },
        ]}
      />,
    );

  return (
    <>
      <Suspense fallback={null}>
        <ComposeFromQuery canWrite={canWrite} />
      </Suspense>
      <div className="sec-h">
        <h2>Announcements</h2>
        <span className="sec-count">{list.isLoading ? 'Loading…' : `${unread} unread`}</span>
        <span className="sp" />
        <Seg<AnnouncementListFilter>
          className="sm"
          ariaLabel="Show announcements"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'All', n: items.length },
            { value: 'important', label: 'Important', n: items.filter((a) => announcementMatchesFilter(a.kind, 'important')).length },
            { value: 'general', label: 'General', n: items.filter((a) => announcementMatchesFilter(a.kind, 'general')).length },
          ]}
        />
        {canWrite ? (
          <Btn cls="sm pri" ico="mega" onClick={compose}>
            New announcement
          </Btn>
        ) : null}
      </div>
      <NextDeadlineCard />
      {list.isError ? (
        <div className="mx-empty" role="alert">
          <b>Announcements could not load</b>
          <span>Check your connection and try again.</span>
          <div className="mx-chips">
            <Btn cls="sm" onClick={() => void list.refetch()}>
              Try again
            </Btn>
          </div>
        </div>
      ) : list.isLoading ? (
        <p className="small upd-pad">Loading announcements…</p>
      ) : shown.length ? (
        <div className="mx-awall">
          {shown.map((a) => (
            <AnnCard
              key={a.id}
              a={a}
              unread={!readIds.has(a.id)}
              canWrite={canWrite}
              onRead={() => {
                markRead([a.id]);
                requestAnnouncementPopup(a);
              }}
              onRemove={(el) => confirmRemove(a, el)}
            />
          ))}
        </div>
      ) : tab === 'important' && items.length ? (
        <div className="mx-empty">
          <Icon name="check" />
          <b>No important updates right now.</b>
          <span>Deadlines and compliance notices show up here first.</span>
          <div className="mx-chips">
            <Btn cls="sm" onClick={() => setTab('all')}>
              See all
            </Btn>
            {ask?.enabled ? (
              <Btn cls="sm" onClick={() => openChat('Which filings are due this week?')}>
                Ask VCFO
              </Btn>
            ) : null}
          </div>
        </div>
      ) : (
        <Empty
          title={tab === 'general' && items.length ? 'No general announcements' : 'Nothing on the board yet'}
          sub={canWrite ? 'Post firm news with New announcement; approved official updates land here too.' : 'Firm news and approved official updates land here.'}
        />
      )}
      {canManageAnnouncementSources(user?.role) ? (
        <div className="upd-gap">
          <WatchedSources />
        </div>
      ) : null}
      <Portals />
    </>
  );
}
